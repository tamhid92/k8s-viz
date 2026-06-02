from flask import Blueprint, request, jsonify, current_app

describe_bp = Blueprint("describe", __name__)

def _container_detail(c) -> dict:
    requests = (c.resources.requests or {}) if c.resources else {}
    limits   = (c.resources.limits or {})   if c.resources else {}
    return {
        "name": c.name,
        "image": c.image or "",
        "ports": [p.container_port for p in (c.ports or [])],
        "cpu_request": requests.get("cpu"),
        "memory_request": requests.get("memory"),
        "cpu_limit": limits.get("cpu"),
        "memory_limit": limits.get("memory"),
        "env_keys": [e.name for e in (c.env or [])],
        "env_from": [
            ef.config_map_ref.name if ef.config_map_ref else ef.secret_ref.name
            for ef in (c.env_from or [])
            if ef.config_map_ref or ef.secret_ref
        ],
    }

def _volume_type(v) -> str:
    if v.config_map:          return f"configMap/{v.config_map.name}"
    if v.secret:              return f"secret/{v.secret.secret_name}"
    if v.persistent_volume_claim: return f"pvc/{v.persistent_volume_claim.claim_name}"
    if v.empty_dir:           return "emptyDir"
    if v.host_path:           return f"hostPath/{v.host_path.path}"
    return "unknown"

def _get_events_for_cached(rc, kind: str, name: str, namespace: str | None) -> list[dict]:
    try:
        if rc:
            events = rc.get('events', namespace)
        else:
            from kubernetes.client import ApiClient
            from flask import current_app
            api = ApiClient()
            if namespace:
                raw = current_app.extensions["k8s_client"].core.list_namespaced_event(namespace=namespace).items
            else:
                raw = current_app.extensions["k8s_client"].core.list_event_for_all_namespaces().items
            events = [api.sanitize_for_serialization(e) for e in raw]
            
        matching = [
            e for e in events
            if e.get("involvedObject", {}).get("kind") == kind
            and e.get("involvedObject", {}).get("name") == name
        ]
        
        def get_ts(e):
            return e.get("lastTimestamp") or e.get("firstTimestamp") or e.get("metadata", {}).get("creationTimestamp") or ""
            
        matching.sort(key=lambda e: get_ts(e), reverse=True)
        
        return [
            {
                "type": e.get("type", "Normal") or "Normal",
                "reason": e.get("reason", "") or "",
                "message": e.get("message", "") or "",
                "count": e.get("count", 1) or 1,
                "first_time": e.get("firstTimestamp"),
                "last_time": e.get("lastTimestamp"),
                "source": e.get("source", {}).get("component"),
            }
            for e in matching[:50]
        ]
    except Exception:
        return []

def _build_describe(kind, name, namespace, k8s, gb, rc) -> dict:
    if kind == "deployment":
        obj = k8s.apps.read_namespaced_deployment(name=name, namespace=namespace)
        desired = obj.spec.replicas or 0
        ready   = obj.status.ready_replicas or 0
        return {
            "kind": "Deployment",
            "name": obj.metadata.name,
            "namespace": obj.metadata.namespace,
            "labels": obj.metadata.labels or {},
            "annotations": {
                k: v for k, v in (obj.metadata.annotations or {}).items()
                if not k.startswith("kubectl.kubernetes.io")
            },
            "created_at": obj.metadata.creation_timestamp.isoformat()
                if obj.metadata.creation_timestamp else None,
            "summary": f"{ready}/{desired} ready",
            "conditions": [
                {"type": c.type, "status": c.status,
                 "reason": c.reason or "", "message": c.message or ""}
                for c in (obj.status.conditions or [])
            ],
            "details": {
                "selector": obj.spec.selector.match_labels or {},
                "strategy": obj.spec.strategy.type or "RollingUpdate",
                "pod_template_labels": obj.spec.template.metadata.labels or {},
                "containers": [_container_detail(c) for c in obj.spec.template.spec.containers or []],
            },
            "events": _get_events_for_cached(rc, "Deployment", name, namespace),
        }

    if kind == "pod":
        obj = k8s.core.read_namespaced_pod(name=name, namespace=namespace)
        cs  = {c.name: c for c in (obj.status.container_statuses or [])}
        return {
            "kind": "Pod",
            "name": obj.metadata.name,
            "namespace": obj.metadata.namespace,
            "labels": obj.metadata.labels or {},
            "annotations": {},
            "created_at": obj.metadata.creation_timestamp.isoformat()
                if obj.metadata.creation_timestamp else None,
            "summary": obj.status.phase or "Unknown",
            "conditions": [
                {"type": c.type, "status": c.status, "reason": "", "message": ""}
                for c in (obj.status.conditions or [])
            ],
            "details": {
                "node_name": obj.spec.node_name,
                "pod_ip": obj.status.pod_ip,
                "host_ip": obj.status.host_ip,
                "containers": [
                    {
                        **_container_detail(c),
                        "ready": cs.get(c.name).ready if cs.get(c.name) else False,
                        "restart_count": cs.get(c.name).restart_count
                            if cs.get(c.name) else 0,
                    }
                    for c in (obj.spec.containers or [])
                ],
                "init_containers": [
                    _container_detail(c) for c in (obj.spec.init_containers or [])
                ],
                "volumes": [
                    {"name": v.name, "type": _volume_type(v)}
                    for v in (obj.spec.volumes or [])
                ],
            },
            "events": _get_events_for_cached(rc, "Pod", name, namespace),
        }

    if kind == "service":
        obj = k8s.core.read_namespaced_service(name=name, namespace=namespace)
        return {
            "kind": "Service",
            "name": obj.metadata.name,
            "namespace": obj.metadata.namespace,
            "labels": obj.metadata.labels or {},
            "annotations": {},
            "created_at": obj.metadata.creation_timestamp.isoformat()
                if obj.metadata.creation_timestamp else None,
            "summary": f"{obj.spec.type} · {obj.spec.cluster_ip}",
            "conditions": [],
            "details": {
                "type": obj.spec.type,
                "cluster_ip": obj.spec.cluster_ip,
                "external_ips": obj.spec.external_i_ps or [],
                "selector": obj.spec.selector or {},
                "ports": [
                    {"name": p.name, "port": p.port,
                     "target_port": str(p.target_port), "protocol": p.protocol}
                    for p in (obj.spec.ports or [])
                ],
                "load_balancer_ip": (
                    obj.status.load_balancer.ingress[0].ip
                    if obj.status.load_balancer
                    and obj.status.load_balancer.ingress
                    else None
                ),
            },
            "events": _get_events_for_cached(rc, "Service", name, namespace),
        }

    if kind == "node":
        obj = k8s.core.read_node(name=name)
        addresses = {a.type: a.address for a in (obj.status.addresses or [])}
        ready_cond = next(
            (c for c in (obj.status.conditions or []) if c.type == "Ready"), None
        )
        roles = [
            k.split("/")[1] for k in (obj.metadata.labels or {})
            if k.startswith("node-role.kubernetes.io/")
        ] or ["worker"]
        return {
            "kind": "Node",
            "name": obj.metadata.name,
            "namespace": None,
            "labels": obj.metadata.labels or {},
            "annotations": {},
            "created_at": obj.metadata.creation_timestamp.isoformat()
                if obj.metadata.creation_timestamp else None,
            "summary": "Ready" if (ready_cond and ready_cond.status == "True") else "NotReady",
            "conditions": [
                {"type": c.type, "status": c.status,
                 "reason": c.reason or "", "message": c.message or ""}
                for c in (obj.status.conditions or [])
            ],
            "details": {
                "roles": roles,
                "internal_ip": addresses.get("InternalIP"),
                "external_ip": addresses.get("ExternalIP"),
                "os_image": obj.status.node_info.os_image if obj.status.node_info else None,
                "kernel": obj.status.node_info.kernel_version if obj.status.node_info else None,
                "container_runtime": obj.status.node_info.container_runtime_version
                    if obj.status.node_info else None,
                "capacity": {
                    "cpu": obj.status.capacity.get("cpu") if obj.status.capacity else None,
                    "memory": obj.status.capacity.get("memory") if obj.status.capacity else None,
                },
                "taints": [
                    {"key": t.key, "effect": t.effect, "value": t.value}
                    for t in (obj.spec.taints or [])
                ],
            },
            "events": _get_events_for_cached(rc, "Node", name, None),
        }

    if kind == "statefulset":
        obj = k8s.apps.read_namespaced_stateful_set(name=name, namespace=namespace)
        return {
            "kind": "StatefulSet",
            "name": obj.metadata.name,
            "namespace": obj.metadata.namespace,
            "labels": obj.metadata.labels or {},
            "annotations": {},
            "created_at": obj.metadata.creation_timestamp.isoformat() if obj.metadata.creation_timestamp else None,
            "summary": f"{obj.status.ready_replicas or 0}/{obj.spec.replicas or 0} ready",
            "conditions": [],
            "details": {
                "replicas": obj.spec.replicas,
                "selector": obj.spec.selector.match_labels or {},
                "service_name": obj.spec.service_name
            },
            "events": _get_events_for_cached(rc, "StatefulSet", name, namespace),
        }

    if kind == "daemonset":
        obj = k8s.apps.read_namespaced_daemon_set(name=name, namespace=namespace)
        return {
            "kind": "DaemonSet",
            "name": obj.metadata.name,
            "namespace": obj.metadata.namespace,
            "labels": obj.metadata.labels or {},
            "annotations": {},
            "created_at": obj.metadata.creation_timestamp.isoformat() if obj.metadata.creation_timestamp else None,
            "summary": f"{obj.status.number_ready or 0}/{obj.status.desired_number_scheduled or 0} ready",
            "conditions": [],
            "details": {
                "desired": obj.status.desired_number_scheduled or 0,
                "ready": obj.status.number_ready or 0,
                "selector": obj.spec.selector.match_labels or {},
            },
            "events": _get_events_for_cached(rc, "DaemonSet", name, namespace),
        }

    if kind == "ingress":
        obj = k8s.networking.read_namespaced_ingress(name=name, namespace=namespace)
        rules = []
        tls_hosts = []
        if obj.spec.rules:
            rules = [r.host for r in obj.spec.rules if r.host]
        if obj.spec.tls:
            for t in obj.spec.tls:
                tls_hosts.extend(t.hosts or [])
        return {
            "kind": "Ingress",
            "name": obj.metadata.name,
            "namespace": obj.metadata.namespace,
            "labels": obj.metadata.labels or {},
            "annotations": {},
            "created_at": obj.metadata.creation_timestamp.isoformat() if obj.metadata.creation_timestamp else None,
            "summary": f"Class: {obj.spec.ingress_class_name or 'None'}",
            "conditions": [],
            "details": {
                "ingress_class": obj.spec.ingress_class_name,
                "rules": rules,
                "tls_hosts": tls_hosts,
            },
            "events": _get_events_for_cached(rc, "Ingress", name, namespace),
        }

    if kind == "networkpolicy":
        obj = k8s.networking.read_namespaced_network_policy(name=name, namespace=namespace)
        return {
            "kind": "NetworkPolicy",
            "name": obj.metadata.name,
            "namespace": obj.metadata.namespace,
            "labels": obj.metadata.labels or {},
            "annotations": {},
            "created_at": obj.metadata.creation_timestamp.isoformat() if obj.metadata.creation_timestamp else None,
            "summary": f"Types: {', '.join(obj.spec.policy_types or [])}",
            "conditions": [],
            "details": {
                "pod_selector": obj.spec.pod_selector.match_labels or {},
                "policy_types": obj.spec.policy_types or [],
                "ingress_rules": len(obj.spec.ingress or []),
                "egress_rules": len(obj.spec.egress or []),
            },
            "events": _get_events_for_cached(rc, "NetworkPolicy", name, namespace),
        }

    if kind == "configmap":
        obj = k8s.core.read_namespaced_config_map(name=name, namespace=namespace)
        return {
            "kind": "ConfigMap",
            "name": obj.metadata.name,
            "namespace": obj.metadata.namespace,
            "labels": obj.metadata.labels or {},
            "annotations": {},
            "created_at": obj.metadata.creation_timestamp.isoformat() if obj.metadata.creation_timestamp else None,
            "summary": f"{len(obj.data or {})} keys",
            "conditions": [],
            "details": {
                "keys": list(obj.data.keys() if obj.data else [])
            },
            "events": _get_events_for_cached(rc, "ConfigMap", name, namespace),
        }

    if kind == "secret":
        obj = k8s.core.read_namespaced_secret(name=name, namespace=namespace)
        return {
            "kind": "Secret",
            "name": obj.metadata.name,
            "namespace": obj.metadata.namespace,
            "labels": obj.metadata.labels or {},
            "annotations": {},
            "created_at": obj.metadata.creation_timestamp.isoformat() if obj.metadata.creation_timestamp else None,
            "summary": f"{obj.type} · {len(obj.data or {})} keys",
            "conditions": [],
            "details": {
                "keys": list(obj.data.keys() if obj.data else []),
                "type": obj.type
            },
            "events": _get_events_for_cached(rc, "Secret", name, namespace),
        }

    if kind == "job":
        obj = k8s.batch.read_namespaced_job(name=name, namespace=namespace)
        conditions = [
            {"type": c.type, "status": c.status,
             "reason": c.reason or "", "message": c.message or ""}
            for c in (obj.status.conditions or [])
        ]
        status_str = "complete" if any(c["type"]=="Complete" and c["status"]=="True"
                                        for c in conditions) else \
                     "failed"   if any(c["type"]=="Failed"   and c["status"]=="True"
                                        for c in conditions) else "running"
        return {
            "kind": "Job", "name": obj.metadata.name, "namespace": obj.metadata.namespace,
            "labels": obj.metadata.labels or {},
            "annotations": {},
            "created_at": obj.metadata.creation_timestamp.isoformat()
                if obj.metadata.creation_timestamp else None,
            "summary": f"{obj.status.succeeded or 0}/{obj.spec.completions or 1} complete · {status_str}",
            "conditions": conditions,
            "details": {
                "parallelism": obj.spec.parallelism or 1,
                "completions": obj.spec.completions or 1,
                "active": obj.status.active or 0,
                "succeeded": obj.status.succeeded or 0,
                "failed": obj.status.failed or 0,
                "selector": obj.spec.selector.match_labels or {} if obj.spec.selector else {},
                "containers": [_container_detail(c)
                               for c in (obj.spec.template.spec.containers or [])],
            },
            "events": _get_events_for_cached(rc, "Job", name, namespace),
        }

    if kind == "cronjob":
        obj = k8s.batch.read_namespaced_cron_job(name=name, namespace=namespace)
        nxt_iso, nxt_rel = None, None
        try:
            from croniter import croniter
            from datetime import datetime, timezone
            cron = croniter(obj.spec.schedule, datetime.now(timezone.utc))
            nxt  = cron.get_next(datetime)
            nxt_iso = nxt.isoformat()
            delta = int((nxt.replace(tzinfo=timezone.utc)
                         - datetime.now(timezone.utc)).total_seconds())
            nxt_rel = (f"in {delta//86400}d" if delta >= 86400 else
                       f"in {delta//3600}h {(delta%3600)//60}m" if delta >= 3600 else
                       f"in {delta//60}m" if delta >= 60 else f"in {delta}s")
        except Exception:
            pass
        return {
            "kind": "CronJob", "name": obj.metadata.name, "namespace": obj.metadata.namespace,
            "labels": obj.metadata.labels or {},
            "annotations": {},
            "created_at": obj.metadata.creation_timestamp.isoformat()
                if obj.metadata.creation_timestamp else None,
            "summary": ("Suspended" if obj.spec.suspend
                        else f"Active · {nxt_rel or 'next run unknown'}"),
            "conditions": [],
            "details": {
                "schedule": obj.spec.schedule,
                "next_run": nxt_rel,
                "next_run_iso": nxt_iso,
                "suspended": obj.spec.suspend or False,
                "concurrency_policy": obj.spec.concurrency_policy,
                "active_jobs": len(obj.status.active or []),
                "last_schedule_time": obj.status.last_schedule_time.isoformat()
                    if obj.status.last_schedule_time else None,
                "successful_history_limit": obj.spec.successful_jobs_history_limit or 3,
                "failed_history_limit": obj.spec.failed_jobs_history_limit or 1,
                "containers": [_container_detail(c)
                               for c in
                               (obj.spec.job_template.spec.template.spec.containers or [])],
            },
            "events": _get_events_for_cached(rc, "CronJob", name, namespace),
        }

    raise ValueError(f"Unsupported kind: {kind}")

@describe_bp.get("/describe")
def describe_resource():
    kind      = request.args.get("kind", "").lower()
    name      = request.args.get("name", "")
    namespace = request.args.get("namespace") or None

    if not kind or not name:
        return jsonify({"error": "kind and name are required"}), 400

    k8s = current_app.extensions["k8s_client"]
    gb  = current_app.extensions.get("graph_builder")
    rc  = current_app.extensions.get("resource_cache")

    try:
        result = _build_describe(kind, name, namespace, k8s, gb, rc)
        return jsonify(result)
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        import traceback
        import logging
        logger = logging.getLogger(__name__)
        logger.exception(f"Describe failed: {traceback.format_exc()}")
        return jsonify({"error": str(e), "traceback": traceback.format_exc()}), 500
