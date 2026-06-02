from app.models.workloads import (
    WorkloadHealth, ContainerSpec, PodSummary, DeploymentItem,
    StatefulSetItem, DaemonSetItem, WorkloadSummary,
    DeploymentListResponse, StatefulSetListResponse, DaemonSetListResponse,
    KubeEvent, EventsResponse,
    ConnectedPodGroup, ConnectedService, ConnectedIngress,
    ConnectedNetworkPolicy, ConnectedConfigMap, ConnectedSecret,
    ConnectedServiceAccount, ConnectedNode, DeploymentMap,
    NamespaceWorkload, NamespaceMapSummary, NamespaceMap,
    JobStatus, JobItem, JobListResponse, CronJobItem, CronJobListResponse
)
from app.core.k8s_client import K8sClient
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

class WorkloadBuilder:
    def __init__(self, k8s_client: K8sClient, graph_builder=None, resource_cache=None):
        self._k8s = k8s_client
        self._gb = graph_builder
        self._cache = resource_cache

    def _label_selector_matches(self, selector: dict[str, str], labels: dict[str, str]) -> bool:
        if not selector:
            return False
        for k, v in selector.items():
            if labels.get(k) != v:
                return False
        return True

    def _pod_summary(self, pod_obj) -> PodSummary:
        status = pod_obj.get("status", {})
        spec = pod_obj.get("spec", {})
        metadata = pod_obj.get("metadata", {})
        
        c_statuses = status.get("containerStatuses", []) or []
        restart_count = sum(cs.get("restartCount", 0) or 0 for cs in c_statuses)
        ready = all(cs.get("ready", False) for cs in c_statuses) if c_statuses else False

        created_at = metadata.get("creationTimestamp")
        
        return PodSummary(
            name=metadata.get("name"),
            phase=status.get("phase", "Unknown") or "Unknown",
            pod_ip=status.get("podIP"),
            node_name=spec.get("nodeName"),
            restart_count=restart_count,
            ready=ready,
            created_at=created_at,
        )

    def _container_spec(self, c) -> ContainerSpec:
        resources = c.get("resources", {}) or {}
        requests = resources.get("requests", {}) or {}
        limits   = resources.get("limits", {}) or {}
        ports = [p.get("containerPort") for p in (c.get("ports", []) or []) if p.get("containerPort")]

        return ContainerSpec(
            name=c.get("name"),
            image=c.get("image", "") or "",
            cpu_request=requests.get("cpu"),
            memory_request=requests.get("memory"),
            cpu_limit=limits.get("cpu"),
            memory_limit=limits.get("memory"),
            ports=ports,
        )

    def _deployment_health(self, dep_obj) -> WorkloadHealth:
        desired   = dep_obj.get('spec', {}).get('replicas', 0) or 0
        ready     = dep_obj.get('status', {}).get('readyReplicas', 0) or 0
        if desired == 0:   return WorkloadHealth.SCALED_DOWN
        if ready == desired: return WorkloadHealth.HEALTHY
        if ready == 0:     return WorkloadHealth.UNAVAILABLE
        return WorkloadHealth.DEGRADED

    def _statefulset_health(self, sts_obj) -> WorkloadHealth:
        desired = sts_obj.get('spec', {}).get('replicas', 0) or 0
        ready   = sts_obj.get('status', {}).get('readyReplicas', 0) or 0
        if desired == 0:     return WorkloadHealth.SCALED_DOWN
        if ready == desired: return WorkloadHealth.HEALTHY
        if ready == 0:       return WorkloadHealth.UNAVAILABLE
        return WorkloadHealth.DEGRADED

    def _daemonset_health(self, ds_obj) -> WorkloadHealth:
        desired    = ds_obj.get('status', {}).get('desiredNumberScheduled', 0) or 0
        available  = ds_obj.get('status', {}).get('numberAvailable', 0) or 0
        if desired == 0:         return WorkloadHealth.SCALED_DOWN
        if available == desired: return WorkloadHealth.HEALTHY
        if available == 0:       return WorkloadHealth.UNAVAILABLE
        return WorkloadHealth.DEGRADED

    def _build_summary(self, health_list: list[WorkloadHealth]) -> WorkloadSummary:
        summary = WorkloadSummary(total=len(health_list))
        for h in health_list:
            if h == WorkloadHealth.HEALTHY:
                summary.healthy += 1
            elif h == WorkloadHealth.DEGRADED:
                summary.degraded += 1
            elif h == WorkloadHealth.UNAVAILABLE:
                summary.unavailable += 1
            elif h == WorkloadHealth.SCALED_DOWN:
                summary.scaled_down += 1
        return summary

    def _pods_for_selector(self, all_pods, selector: dict, namespace: str) -> list:
        matching = []
        for p in all_pods:
            meta = p.get("metadata", {})
            if meta.get("namespace") == namespace and meta.get("labels"):
                if self._label_selector_matches(selector, meta.get("labels")):
                    matching.append(p)
        return matching

    def _job_status(self, job_obj) -> JobStatus:
        if job_obj.get("spec", {}).get("suspend"):
            return JobStatus.SUSPENDED
        conditions = job_obj.get("status", {}).get("conditions") or []
        for c in conditions:
            if c.get("type") == "Complete" and c.get("status") == "True":
                return JobStatus.COMPLETE
            if c.get("type") == "Failed" and c.get("status") == "True":
                return JobStatus.FAILED
        if (job_obj.get("status", {}).get("active") or 0) > 0:
            return JobStatus.RUNNING
        if (job_obj.get("status", {}).get("failed") or 0) > 0:
            return JobStatus.FAILED
        return JobStatus.RUNNING

    def _job_duration(self, job_obj) -> str | None:
        start_str = job_obj.get("status", {}).get("startTime")
        end_str   = job_obj.get("status", {}).get("completionTime")
        if not start_str:
            return None
        from datetime import datetime, timezone
        start = datetime.fromisoformat(start_str.replace("Z", "+00:00"))
        end = datetime.fromisoformat(end_str.replace("Z", "+00:00")) if end_str else None
        now = datetime.now(timezone.utc)
        ref = end if end else now
        delta = ref - start.replace(tzinfo=timezone.utc) if start.tzinfo is None else ref - start
        total = int(delta.total_seconds())
        if total < 0:
            return None
        minutes, seconds = divmod(total, 60)
        hours, minutes   = divmod(minutes, 60)
        if end:
            if hours:   return f"{hours}h {minutes}m {seconds}s"
            if minutes: return f"{minutes}m {seconds}s"
            return f"{seconds}s"
        else:
            if hours:   return f"running {hours}h {minutes}m"
            if minutes: return f"running {minutes}m {seconds}s"
            return f"running {seconds}s"

    def _next_schedule(self, schedule: str) -> tuple[str | None, str | None]:
        try:
            from croniter import croniter
            base = datetime.now(timezone.utc)
            cron = croniter(schedule, base)
            nxt  = cron.get_next(datetime)
            delta = int((nxt.replace(tzinfo=timezone.utc) - base).total_seconds())
            if delta < 60:
                rel = f"in {delta}s"
            elif delta < 3600:
                rel = f"in {delta // 60}m"
            elif delta < 86400:
                h = delta // 3600
                m = (delta % 3600) // 60
                rel = f"in {h}h {m}m"
            else:
                rel = f"in {delta // 86400}d"
            return nxt.isoformat(), rel
        except Exception:
            return None, None

    def get_jobs(self, namespace: str | None = None) -> JobListResponse:
        raw_jobs = self._fetch('jobs', namespace, self._k8s.list_jobs)
        all_pods = self._fetch('pods', namespace, self._k8s.list_pods)

        items = []
        for job in raw_jobs:
            meta      = job.get("metadata", {})
            spec      = job.get("spec", {})
            status    = job.get("status", {})

            # Owner CronJob
            owner_cj = None
            for ref in (meta.get("ownerReferences") or []):
                if ref.get("kind") == "CronJob":
                    owner_cj = ref.get("name")
                    break

            # Selector
            selector = spec.get("selector", {}).get("matchLabels", {})

            # Pods for this job
            job_pods = [
                p for p in all_pods
                if p.get("metadata", {}).get("namespace") == meta.get("namespace")
                and self._label_selector_matches(selector, p.get("metadata", {}).get("labels", {}))
            ]
            pod_summaries = [self._pod_summary(p) for p in job_pods]

            items.append(JobItem(
                name            = meta.get("name"),
                namespace       = meta.get("namespace"),
                completions     = spec.get("completions", 1) or 1,
                succeeded       = status.get("succeeded", 0) or 0,
                active          = status.get("active", 0) or 0,
                failed          = status.get("failed", 0) or 0,
                status          = self._job_status(job),
                start_time      = status.get("startTime"),
                completion_time = status.get("completionTime"),
                duration        = self._job_duration(job),
                parallelism     = spec.get("parallelism", 1) or 1,
                created_at      = meta.get("creationTimestamp"),
                pods            = pod_summaries,
                owner_cronjob   = owner_cj,
            ))

        items.sort(key=lambda j: (j.namespace, j.name))

        counts = {s: sum(1 for j in items if j.status == s) for s in JobStatus}
        summary = WorkloadSummary(
            total       = len(items),
            healthy     = counts.get(JobStatus.COMPLETE, 0),
            degraded    = counts.get(JobStatus.RUNNING, 0),
            unavailable = counts.get(JobStatus.FAILED, 0),
            scaled_down = counts.get(JobStatus.SUSPENDED, 0),
        )
        return JobListResponse(items=items, summary=summary)

    def get_cron_jobs(self, namespace: str | None = None) -> CronJobListResponse:
        raw_cjs = self._fetch('cronjobs', namespace, self._k8s.list_cron_jobs)

        # fetch all jobs once to find owned jobs
        try:
            all_jobs_resp = self.get_jobs(namespace)
            all_jobs = all_jobs_resp.items
        except Exception:
            all_jobs = []

        items = []
        for cj in raw_cjs:
            meta   = cj.get("metadata", {})
            spec   = cj.get("spec", {})
            status = cj.get("status", {})

            # jobs owned by this cronjob
            owned = [j for j in all_jobs if j.owner_cronjob == meta.get("name")
                     and j.namespace == meta.get("namespace")]
            owned.sort(key=lambda j: j.created_at or "", reverse=True)
            recent = owned[:10]

            nxt_iso, nxt_rel = self._next_schedule(spec.get("schedule", ""))

            items.append(CronJobItem(
                name                          = meta.get("name"),
                namespace                     = meta.get("namespace"),
                schedule                      = spec.get("schedule", ""),
                suspended                     = spec.get("suspend", False) or False,
                active_jobs                   = len(status.get("active") or []),
                last_schedule_time            = status.get("lastScheduleTime"),
                last_successful_time          = status.get("lastSuccessfulTime"),
                next_schedule_time            = nxt_iso,
                next_schedule_relative        = nxt_rel,
                concurrency_policy            = spec.get("concurrencyPolicy", "Allow"),
                successful_jobs_history_limit = spec.get("successfulJobsHistoryLimit", 3),
                failed_jobs_history_limit     = spec.get("failedJobsHistoryLimit", 1),
                created_at                    = meta.get("creationTimestamp"),
                recent_jobs                   = recent,
            ))

        items.sort(key=lambda c: (c.namespace, c.name))
        return CronJobListResponse(items=items)

    def _fetch(self, resource_type, namespace, list_fn):
        if hasattr(self, '_cache') and self._cache:
            return self._cache.get(resource_type, namespace)
        try:
            from kubernetes.client import ApiClient
            api = ApiClient()
            return [api.sanitize_for_serialization(o) for o in list_fn(namespace).items]
        except Exception as e:
            logger.error(f"Failed to list {resource_type}: {e}")
            return []

    def get_deployments(self, namespace: str | None = None) -> DeploymentListResponse:
        deployments = self._fetch('deployments', namespace, self._k8s.list_deployments)
        all_pods = self._fetch('pods', namespace, self._k8s.list_pods)

        items = []
        health_list = []
        for dep in deployments:
            meta = dep.get("metadata", {})
            spec = dep.get("spec", {})
            status = dep.get("status", {})
            
            match_labels = spec.get("selector", {}).get("matchLabels", {})
            dep_ns = meta.get("namespace")
            pods = self._pods_for_selector(all_pods, match_labels, dep_ns)
            
            pod_summaries = [self._pod_summary(p) for p in pods]
            total_restarts = sum(p.restart_count for p in pod_summaries)
            health = self._deployment_health(dep)
            health_list.append(health)

            containers = [self._container_spec(c) for c in spec.get("template", {}).get("spec", {}).get("containers", [])]

            items.append(DeploymentItem(
                name=meta.get("name"),
                namespace=dep_ns,
                desired_replicas=spec.get("replicas", 0) or 0,
                ready_replicas=status.get("readyReplicas", 0) or 0,
                available_replicas=status.get("availableReplicas", 0) or 0,
                updated_replicas=status.get("updatedReplicas", 0) or 0,
                strategy=spec.get("strategy", {}).get("type", "Unknown"),
                selector=match_labels,
                containers=containers,
                created_at=meta.get("creationTimestamp"),
                health=health,
                total_restarts=total_restarts,
                pods=pod_summaries
            ))

        items.sort(key=lambda x: (x.namespace, x.name))
        summary = self._build_summary(health_list)
        return DeploymentListResponse(items=items, summary=summary)

    def get_statefulsets(self, namespace: str | None = None) -> StatefulSetListResponse:
        statefulsets = self._fetch('statefulsets', namespace, self._k8s.list_statefulsets)
        all_pods = self._fetch('pods', namespace, self._k8s.list_pods)

        items = []
        health_list = []
        for sts in statefulsets:
            meta = sts.get("metadata", {})
            spec = sts.get("spec", {})
            status = sts.get("status", {})
            
            match_labels = spec.get("selector", {}).get("matchLabels", {})
            sts_ns = meta.get("namespace")
            pods = self._pods_for_selector(all_pods, match_labels, sts_ns)
            
            pod_summaries = [self._pod_summary(p) for p in pods]
            total_restarts = sum(p.restart_count for p in pod_summaries)
            health = self._statefulset_health(sts)
            health_list.append(health)

            containers = [self._container_spec(c) for c in spec.get("template", {}).get("spec", {}).get("containers", [])]

            items.append(StatefulSetItem(
                name=meta.get("name"),
                namespace=sts_ns,
                desired_replicas=spec.get("replicas", 0) or 0,
                ready_replicas=status.get("readyReplicas", 0) or 0,
                current_replicas=status.get("currentReplicas", 0) or 0,
                selector=match_labels,
                containers=containers,
                created_at=meta.get("creationTimestamp"),
                health=health,
                total_restarts=total_restarts,
                pods=pod_summaries,
                service_name=spec.get("serviceName")
            ))

        items.sort(key=lambda x: (x.namespace, x.name))
        summary = self._build_summary(health_list)
        return StatefulSetListResponse(items=items, summary=summary)

    def get_daemonsets(self, namespace: str | None = None) -> DaemonSetListResponse:
        daemonsets = self._fetch('daemonsets', namespace, self._k8s.list_daemonsets)
        all_pods = self._fetch('pods', namespace, self._k8s.list_pods)

        items = []
        health_list = []
        for ds in daemonsets:
            meta = ds.get("metadata", {})
            spec = ds.get("spec", {})
            status = ds.get("status", {})
            
            match_labels = spec.get("selector", {}).get("matchLabels", {})
            ds_ns = meta.get("namespace")
            pods = self._pods_for_selector(all_pods, match_labels, ds_ns)
            
            pod_summaries = [self._pod_summary(p) for p in pods]
            total_restarts = sum(p.restart_count for p in pod_summaries)
            health = self._daemonset_health(ds)
            health_list.append(health)

            containers = [self._container_spec(c) for c in spec.get("template", {}).get("spec", {}).get("containers", [])]

            items.append(DaemonSetItem(
                name=meta.get("name"),
                namespace=ds_ns,
                desired_number_scheduled=status.get("desiredNumberScheduled", 0) or 0,
                number_ready=status.get("numberReady", 0) or 0,
                number_available=status.get("numberAvailable", 0) or 0,
                number_misscheduled=status.get("numberMisscheduled", 0) or 0,
                selector=match_labels,
                containers=containers,
                created_at=meta.get("creationTimestamp"),
                health=health,
                total_restarts=total_restarts,
                pods=pod_summaries
            ))

        items.sort(key=lambda x: (x.namespace, x.name))
        summary = self._build_summary(health_list)
        return DaemonSetListResponse(items=items, summary=summary)

    def get_events(self, namespace: str | None = None, regarding: str | None = None) -> EventsResponse:
        events = self._fetch('events', namespace, self._k8s.list_events)

        def sort_key(e):
            return e.get("lastTimestamp") or e.get("firstTimestamp") or e.get("metadata", {}).get("creationTimestamp") or ""

        # Sort robustly since timestamps can be None
        events.sort(key=lambda x: sort_key(x), reverse=True)

        parsed_events = []
        for event in events:
            involved = event.get("involvedObject", {})
            kind = involved.get("kind", "")
            name = involved.get("name", "")
            reg = f"{kind}/{name}"
            
            if regarding and reg.lower() != regarding.lower():
                continue

            parsed_events.append(KubeEvent(
                uid=event.get("metadata", {}).get("uid"),
                type=event.get("type", "Normal"),
                reason=event.get("reason", ""),
                message=event.get("message", ""),
                count=event.get("count", 1),
                first_time=event.get("firstTimestamp"),
                last_time=event.get("lastTimestamp"),
                regarding=reg
            ))

            if len(parsed_events) >= 100:
                break

        return EventsResponse(events=parsed_events)

    def get_deployment_map(self, namespace: str, name: str) -> DeploymentMap:
        import kubernetes
        import re
        from kubernetes.client import ApiClient
        
        dep = None
        if hasattr(self, '_cache') and self._cache:
            deps = self._cache.get('deployments', namespace)
            dep = next((d for d in deps if d.get("metadata", {}).get("name") == name), None)
            
        if not dep:
            try:
                raw_dep = self._k8s.apps.read_namespaced_deployment(name=name, namespace=namespace)
                dep = ApiClient().sanitize_for_serialization(raw_dep)
            except kubernetes.client.exceptions.ApiException as e:
                if e.status == 404:
                    raise ValueError(f"Deployment {namespace}/{name} not found")
                raise

        meta = dep.get("metadata", {})
        spec = dep.get("spec", {})
        status = dep.get("status", {})

        pod_labels = spec.get("selector", {}).get("matchLabels", {})
        health = self._deployment_health(dep)
        desired = spec.get("replicas", 0) or 0
        ready = status.get("readyReplicas", 0) or 0

        pod_groups_map = {}
        all_matched_pods = []

        if self._gb and self._gb.graph:
            for n in self._gb.graph.nodes:
                if n.type.name == "POD" and n.namespace == namespace:
                    n_labels = dict(n.data.labels) if n.data and hasattr(n.data, "labels") else {}
                    if self._label_selector_matches(pod_labels, n_labels):
                        ps = PodSummary(
                            name=n.label,
                            phase=n.data.phase.value if hasattr(n.data.phase, "value") else str(n.data.phase),
                            pod_ip=n.data.pod_ip,
                            node_name=n.data.node_name,
                            restart_count=n.data.restart_count,
                            ready=n.data.ready,
                            created_at=None
                        )
                        all_matched_pods.append((ps, n_labels))
        else:
            raw_pods = self._fetch('pods', namespace, self._k8s.list_pods)
            for p in raw_pods:
                labels = p.get("metadata", {}).get("labels", {})
                if self._label_selector_matches(pod_labels, labels):
                    ps = self._pod_summary(p)
                    all_matched_pods.append((ps, labels))

        def derive_label(pod_name, labels):
            if labels.get("app.kubernetes.io/name"): return labels["app.kubernetes.io/name"]
            if labels.get("app"): return labels["app"]
            if labels.get("k8s-app"): return labels["k8s-app"]
            parts = pod_name.split("-")
            if len(parts) > 2:
                sec_last = parts[-2]
                if 8 <= len(sec_last) <= 10 and re.match(r'^[0-9a-f]+$', sec_last):
                    return "-".join(parts[:-2])
            if len(parts) > 1:
                return "-".join(parts[:-1])
            return pod_name

        for ps, labels in all_matched_pods:
            lbl = derive_label(ps.name, labels)
            if lbl not in pod_groups_map:
                pod_groups_map[lbl] = {"pods": [], "nodes": set()}
            pod_groups_map[lbl]["pods"].append(ps)
            if ps.node_name:
                pod_groups_map[lbl]["nodes"].add(ps.node_name)

        pod_groups = []
        for lbl, data in pod_groups_map.items():
            pod_groups.append(ConnectedPodGroup(
                label=lbl,
                replica_count=len(data["pods"]),
                pods=data["pods"],
                host_nodes=list(data["nodes"])
            ))

        unique_node_names = set()
        for ps, _ in all_matched_pods:
            if ps.node_name:
                unique_node_names.add(ps.node_name)

        connected_nodes = []
        if self._gb and self._gb.graph:
            for nn in unique_node_names:
                n_node = self._gb.graph.get_node(f"node/{nn}")
                if n_node:
                    connected_nodes.append(ConnectedNode(
                        name=nn,
                        internal_ip=n_node.data.internal_ip,
                        roles=n_node.data.roles,
                        ready=n_node.data.ready
                    ))
                else:
                    connected_nodes.append(ConnectedNode(name=nn, roles=[], ready=True))
        else:
            for nn in unique_node_names:
                connected_nodes.append(ConnectedNode(name=nn, roles=[], ready=True))

        connected_services = []
        if self._gb and self._gb.graph:
            for n in self._gb.graph.nodes:
                if n.type.name == "SERVICE" and n.namespace == namespace:
                    if self._label_selector_matches(n.data.selector, pod_labels):
                        ports_list = [{"port": p.port, "target_port": p.target_port, "protocol": p.protocol} for p in n.data.ports]
                        connected_services.append(ConnectedService(
                            name=n.label,
                            namespace=n.namespace,
                            cluster_ip=n.data.cluster_ip,
                            service_type=n.data.service_type.value if hasattr(n.data.service_type, "value") else str(n.data.service_type),
                            ports=ports_list
                        ))

        connected_ingresses = []
        if self._gb and self._gb.graph:
            svc_names = {s.name for s in connected_services}
            for n in self._gb.graph.nodes:
                if n.type.name == "INGRESS" and n.namespace == namespace:
                    targets_matched = False
                    hosts = []
                    for r in n.data.rules:
                        if r.host: hosts.append(r.host)
                        for p in r.paths:
                            if p.service_name in svc_names:
                                targets_matched = True
                    if targets_matched:
                        connected_ingresses.append(ConnectedIngress(
                            name=n.label,
                            namespace=n.namespace,
                            ingress_class=n.data.ingress_class,
                            hosts=list(set(hosts))
                        ))

        connected_netpols = []
        if self._gb and self._gb.graph:
            for n in self._gb.graph.nodes:
                if n.type.name == "NETWORK_POLICY" and n.namespace == namespace:
                    if self._label_selector_matches(n.data.pod_selector, pod_labels):
                        pt = n.data.policy_types
                        if "Ingress" in pt and "Egress" in pt: sum_str = "Ingress+Egress"
                        elif "Ingress" in pt: sum_str = "Ingress"
                        elif "Egress" in pt: sum_str = "Egress"
                        else: sum_str = "None"
                        connected_netpols.append(ConnectedNetworkPolicy(
                            name=n.label,
                            namespace=n.namespace,
                            policy_types=pt,
                            summary=sum_str
                        ))

        template_spec = spec.get("template", {}).get("spec", {})
        sa_name = template_spec.get("serviceAccountName")
        connected_sa = None
        if sa_name and sa_name != "default":
            connected_sa = ConnectedServiceAccount(name=sa_name, namespace=namespace)

        cm_map = {}
        sec_map = {}

        volumes = template_spec.get("volumes", []) or []
        for vol in volumes:
            if vol.get("configMap"):
                name_ = vol.get("configMap").get("name")
                if name_: cm_map[name_] = "volume"
            if vol.get("secret"):
                name_ = vol.get("secret").get("secretName")
                if name_: sec_map[name_] = "volume"

        containers = (template_spec.get("containers", []) or []) + (template_spec.get("initContainers", []) or [])
        for c in containers:
            for envFrom in (c.get("envFrom", []) or []):
                if envFrom.get("configMapRef"):
                    name_ = envFrom.get("configMapRef").get("name")
                    if name_: cm_map[name_] = "envFrom"
                if envFrom.get("secretRef"):
                    name_ = envFrom.get("secretRef").get("name")
                    if name_: sec_map[name_] = "envFrom"

            for env in (c.get("env", []) or []):
                if env.get("valueFrom"):
                    if env.get("valueFrom").get("configMapKeyRef"):
                        name_ = env.get("valueFrom").get("configMapKeyRef").get("name")
                        if name_: cm_map[name_] = "env"
                    if env.get("valueFrom").get("secretKeyRef"):
                        name_ = env.get("valueFrom").get("secretKeyRef").get("name")
                        if name_: sec_map[name_] = "env"

        connected_cms = []
        for name, mtype in cm_map.items():
            try:
                cm = self._k8s.core.read_namespaced_config_map(name=name, namespace=namespace)
                keys = list((cm.data or {}).keys())
            except Exception:
                keys = []
            connected_cms.append(ConnectedConfigMap(name=name, namespace=namespace, mount_type=mtype, keys=keys))

        connected_secs = []
        for name, mtype in sec_map.items():
            try:
                sec = self._k8s.core.read_namespaced_secret(name=name, namespace=namespace)
                keys = list((sec.data or {}).keys())
                sec_type = sec.type or "Opaque"
            except Exception:
                keys = []
                sec_type = "Opaque"
            connected_secs.append(ConnectedSecret(name=name, namespace=namespace, mount_type=mtype, keys=keys, secret_type=sec_type))

        return DeploymentMap(
            deployment_name=name,
            namespace=namespace,
            desired_replicas=desired,
            ready_replicas=ready,
            health=health,
            pod_groups=pod_groups,
            nodes=connected_nodes,
            services=connected_services,
            ingresses=connected_ingresses,
            network_policies=connected_netpols,
            config_maps=connected_cms,
            secrets=connected_secs,
            service_account=connected_sa
        )

    def get_namespace_map(self, namespace: str) -> NamespaceMap:
        import re

        deps = self._fetch('deployments', namespace, self._k8s.list_deployments)
        stss = self._fetch('statefulsets', namespace, self._k8s.list_statefulsets)
        dss  = self._fetch('daemonsets', namespace, self._k8s.list_daemonsets)

        pod_nodes = []
        if self._gb and self._gb.graph:
            for n in self._gb.graph.nodes:
                if n.type.name == "POD" and n.namespace == namespace:
                    pod_nodes.append(n)

        def derive_label(pod_name, labels):
            if labels.get("app.kubernetes.io/name"): return labels["app.kubernetes.io/name"]
            if labels.get("app"): return labels["app"]
            if labels.get("k8s-app"): return labels["k8s-app"]
            parts = pod_name.split("-")
            if len(parts) > 2:
                sec_last = parts[-2]
                if 8 <= len(sec_last) <= 10 and re.match(r'^[0-9a-f]+$', sec_last):
                    return "-".join(parts[:-2])
            if len(parts) > 1:
                return "-".join(parts[:-1])
            return pod_name

        connected_services = []
        if self._gb and self._gb.graph:
            for n in self._gb.graph.nodes:
                if n.type.name == "SERVICE" and n.namespace == namespace:
                    ports_list = [{"port": p.port, "target_port": p.target_port, "protocol": p.protocol} for p in n.data.ports]
                    connected_services.append(ConnectedService(
                        name=n.label,
                        namespace=n.namespace,
                        cluster_ip=n.data.cluster_ip,
                        service_type=n.data.service_type.value if hasattr(n.data.service_type, "value") else str(n.data.service_type),
                        ports=ports_list
                    ))

        def find_service_names(pod_labels):
            s_names = []
            if not pod_labels:
                return s_names
            if self._gb and self._gb.graph:
                for n in self._gb.graph.nodes:
                    if n.type.name == "SERVICE" and n.namespace == namespace:
                        if n.data.selector and self._label_selector_matches(n.data.selector, pod_labels):
                            s_names.append(n.label)
            return s_names

        all_matched_pod_nodes = []
        workloads = []

        def process_workload(items, kind, health_func):
            for obj in items:
                meta = obj.get("metadata", {})
                spec = obj.get("spec", {})
                status = obj.get("status", {})
                
                match_labels = spec.get("selector", {}).get("matchLabels", {})
                matched_pods = []
                for p in pod_nodes:
                    p_labels = dict(p.data.labels) if p.data and hasattr(p.data, "labels") else {}
                    if self._label_selector_matches(match_labels, p_labels):
                        matched_pods.append((p, p_labels))

                if not matched_pods:
                    pod_group = ConnectedPodGroup(
                        label=meta.get("name"),
                        replica_count=0,
                        pods=[],
                        host_nodes=[]
                    )
                else:
                    first_label = derive_label(matched_pods[0][0].label, matched_pods[0][1])
                    pods_list = []
                    nodes_set = set()
                    for p, _ in matched_pods:
                        ps = PodSummary(
                            name=p.label,
                            phase=p.data.phase.value if hasattr(p.data.phase, "value") else str(p.data.phase),
                            pod_ip=p.data.pod_ip,
                            node_name=p.data.node_name,
                            restart_count=p.data.restart_count,
                            ready=p.data.ready,
                            created_at=None
                        )
                        pods_list.append(ps)
                        if p.data.node_name:
                            nodes_set.add(p.data.node_name)
                            all_matched_pod_nodes.append(p.data.node_name)
                    
                    pod_group = ConnectedPodGroup(
                        label=first_label,
                        replica_count=len(pods_list),
                        pods=pods_list,
                        host_nodes=list(nodes_set)
                    )

                health = health_func(obj)
                
                if kind == "Deployment" or kind == "StatefulSet":
                    ready_replicas = status.get("readyReplicas", 0) or 0
                    desired_replicas = spec.get("replicas", 0) or 0
                    ready_string = f"{ready_replicas}/{desired_replicas}"
                else:
                    number_ready = status.get("numberReady", 0) or 0
                    desired_number = status.get("desiredNumberScheduled", 0) or 0
                    ready_string = f"{number_ready}/{desired_number}"

                svc_names = find_service_names(match_labels)

                workloads.append(NamespaceWorkload(
                    kind=kind,
                    name=meta.get("name"),
                    namespace=meta.get("namespace"),
                    health=health,
                    ready_string=ready_string,
                    pod_group=pod_group,
                    service_names=svc_names
                ))

        process_workload(deps, "Deployment", self._deployment_health)
        process_workload(stss, "StatefulSet", self._statefulset_health)
        process_workload(dss, "DaemonSet", self._daemonset_health)

        unique_node_names = set(all_matched_pod_nodes)
        connected_nodes = []
        if self._gb and self._gb.graph:
            for nn in unique_node_names:
                n_node = self._gb.graph.get_node(f"node/{nn}")
                if n_node:
                    connected_nodes.append(ConnectedNode(
                        name=nn,
                        internal_ip=n_node.data.internal_ip,
                        roles=n_node.data.roles,
                        ready=n_node.data.ready
                    ))
                else:
                    connected_nodes.append(ConnectedNode(name=nn, roles=[], ready=True))

        connected_ingresses = []
        if self._gb and self._gb.graph:
            for n in self._gb.graph.nodes:
                if n.type.name == "INGRESS" and n.namespace == namespace:
                    hosts = []
                    for r in n.data.rules:
                        if r.host: hosts.append(r.host)
                    connected_ingresses.append(ConnectedIngress(
                        name=n.label,
                        namespace=n.namespace,
                        ingress_class=n.data.ingress_class,
                        hosts=list(set(hosts))
                    ))

        connected_netpols = []
        if self._gb and self._gb.graph:
            for n in self._gb.graph.nodes:
                if n.type.name == "NETWORK_POLICY" and n.namespace == namespace:
                    pt = n.data.policy_types
                    sum_str = "+".join(pt) if pt else "None"
                    connected_netpols.append(ConnectedNetworkPolicy(
                        name=n.label,
                        namespace=n.namespace,
                        policy_types=pt,
                        summary=sum_str
                    ))

        try:
            cms = self._k8s.list_config_maps(namespace).items
        except Exception as e:
            logger.error(f"Failed to list config maps: {e}")
            cms = []

        try:
            secs = self._k8s.list_secrets(namespace).items
        except Exception as e:
            logger.error(f"Failed to list secrets: {e}")
            secs = []

        try:
            sas = self._k8s.list_service_accounts(namespace).items
        except Exception as e:
            logger.error(f"Failed to list service accounts: {e}")
            sas = []

        connected_cms = []
        for cm in cms:
            name = cm.metadata.name
            if name.startswith("kube-") or name.startswith("coredns"):
                continue
            keys = list((cm.data or {}).keys())
            connected_cms.append(ConnectedConfigMap(
                name=name,
                namespace=namespace,
                mount_type="namespace",
                keys=keys
            ))

        connected_secs = []
        for sec in secs:
            name = sec.metadata.name
            sec_type = sec.type or "Opaque"
            if sec_type == "kubernetes.io/service-account-token":
                continue
            keys = list((sec.data or {}).keys())
            connected_secs.append(ConnectedSecret(
                name=name,
                namespace=namespace,
                mount_type="namespace",
                keys=keys,
                secret_type=sec_type
            ))

        connected_sas = []
        for sa in sas:
            connected_sas.append(ConnectedServiceAccount(
                name=sa.metadata.name,
                namespace=namespace
            ))

        total_pods = sum(w.pod_group.replica_count for w in workloads)
        summary = NamespaceMapSummary(
            workloads=len(workloads),
            pods=total_pods,
            services=len(connected_services),
            ingresses=len(connected_ingresses),
            network_policies=len(connected_netpols),
            config_maps=len(connected_cms),
            secrets=len(connected_secs),
            service_accounts=len(connected_sas)
        )

        return NamespaceMap(
            namespace=namespace,
            workloads=workloads,
            services=connected_services,
            ingresses=connected_ingresses,
            network_policies=connected_netpols,
            config_maps=connected_cms,
            secrets=connected_secs,
            service_accounts=connected_sas,
            nodes=connected_nodes,
            summary=summary
        )
