import threading

from app.models.graph import (
    ClusterInfo,
    ClusterNodeData,
    ContainerInfo,
    EdgeData,
    EdgeType,
    Graph,
    GraphDelta,
    GraphEdge,
    GraphNode,
    IngressData,
    IngressPath,
    IngressRule,
    NamespaceData,
    NetworkPolicyData,
    NetworkPolicyPeer,
    NetworkPolicyPort,
    NetworkPolicyRule,
    NodeType,
    PodData,
    PodPhase,
    ServiceData,
    ServicePort,
    ServiceType,
    WatchEventType,
)


class GraphBuilder:
    def __init__(self, k8s_client):
        self._k8s = k8s_client
        self.graph = Graph()
        self.is_ready = False
        self._lock = threading.RLock()

    def full_sync(self):
        with self._lock:
            self.graph.clear()

            server_version = self._k8s.get_server_version()
            raw_nodes = self._k8s.list_nodes().items
            raw_namespaces = self._k8s.list_namespaces().items

            platform = None
            for n in raw_nodes:
                labels = n.metadata.labels or {}
                if "node.kubernetes.io/instance-type" in labels:
                    platform = "cloud"
                    break
                if any("k3s" in str(v) for v in labels.values()):
                    platform = "k3s"
                    break

            self.graph.cluster_info = ClusterInfo(
                server_version=server_version,
                platform=platform,
                node_count=len(raw_nodes),
                namespace_count=len(raw_namespaces),
            )

            for ns in raw_namespaces:
                self.graph.upsert_node(self._build_namespace_node(ns))
            for n in raw_nodes:
                self.graph.upsert_node(self._build_cluster_node(n))
            for pod in self._k8s.list_pods().items:
                self.graph.upsert_node(self._build_pod_node(pod))
            for svc in self._k8s.list_services().items:
                self.graph.upsert_node(self._build_service_node(svc))
            for ing in self._k8s.list_ingresses().items:
                self.graph.upsert_node(self._build_ingress_node(ing))
            for np in self._k8s.list_network_policies().items:
                self.graph.upsert_node(self._build_network_policy_node(np))

            self._derive_all_edges()
            self.is_ready = True

    def handle_event(self, resource_type, event_type, raw_obj) -> GraphDelta:
        with self._lock:
            if event_type == "DELETED":
                meta = raw_obj.metadata
                name = meta.name
                ns = getattr(meta, "namespace", None)
                node_id = self._make_id(resource_type, name, ns)
                self.graph.remove_node(node_id)
                return GraphDelta(event=WatchEventType.DELETED, node_id=node_id)

            node = self._build_node(resource_type, raw_obj)
            if node is None:
                return GraphDelta(event=WatchEventType.MODIFIED)

            self.graph.upsert_node(node)
            edges_added, edge_ids_removed = self._recompute_edges_for_node(node)
            event = WatchEventType.ADDED if event_type == "ADDED" else WatchEventType.MODIFIED
            return GraphDelta(
                event=event,
                node=node,
                edges_added=edges_added,
                edges_removed=edge_ids_removed,
            )

    def _make_id(self, resource_type, name, namespace):
        if resource_type == "namespace":
            return f"namespace/{name}"
        if resource_type == "node":
            return f"node/{name}"
        if resource_type == "pod":
            return f"pod/{namespace}/{name}"
        if resource_type == "service":
            return f"svc/{namespace}/{name}"
        if resource_type == "ingress":
            return f"ingress/{namespace}/{name}"
        if resource_type == "network_policy":
            return f"netpol/{namespace}/{name}"
        return f"{resource_type}/{name}"

    def _build_node(self, resource_type, raw_obj):
        if resource_type == "namespace":
            return self._build_namespace_node(raw_obj)
        if resource_type == "node":
            return self._build_cluster_node(raw_obj)
        if resource_type == "pod":
            return self._build_pod_node(raw_obj)
        if resource_type == "service":
            return self._build_service_node(raw_obj)
        if resource_type == "ingress":
            return self._build_ingress_node(raw_obj)
        if resource_type == "network_policy":
            return self._build_network_policy_node(raw_obj)
        return None

    def _build_namespace_node(self, ns_obj) -> GraphNode:
        meta = ns_obj.metadata
        name = meta.name
        labels = dict(meta.labels or {})
        annotations = dict(meta.annotations or {})
        status = ns_obj.status.phase or "Active"
        return GraphNode(
            id=f"namespace/{name}",
            type=NodeType.NAMESPACE,
            label=name,
            namespace=None,
            data=NamespaceData(status=status, labels=labels, annotations=annotations),
        )

    def _build_cluster_node(self, node_obj) -> GraphNode:
        meta = node_obj.metadata
        name = meta.name
        labels = dict(meta.labels or {})

        roles = [
            k.split("/")[1]
            for k in labels
            if k.startswith("node-role.kubernetes.io/")
        ]
        if not roles:
            roles = ["worker"]

        internal_ip = None
        external_ip = None
        for addr in (node_obj.status.addresses or []):
            if addr.type == "InternalIP":
                internal_ip = addr.address
            elif addr.type == "ExternalIP":
                external_ip = addr.address

        ready = False
        for cond in (node_obj.status.conditions or []):
            if cond.type == "Ready":
                ready = cond.status == "True"
                break

        info = node_obj.status.node_info
        taints = []
        for t in (node_obj.spec.taints or []):
            taints.append({"key": t.key, "value": t.value, "effect": t.effect})

        capacity = node_obj.status.capacity or {}

        return GraphNode(
            id=f"node/{name}",
            type=NodeType.CLUSTER_NODE,
            label=name,
            namespace=None,
            data=ClusterNodeData(
                roles=roles,
                internal_ip=internal_ip,
                external_ip=external_ip,
                os_image=info.os_image if info else None,
                kernel_version=info.kernel_version if info else None,
                container_runtime=info.container_runtime_version if info else None,
                ready=ready,
                cpu_capacity=capacity.get("cpu"),
                memory_capacity=capacity.get("memory"),
                labels=labels,
                taints=taints,
            ),
        )

    def _build_pod_node(self, pod_obj) -> GraphNode:
        meta = pod_obj.metadata
        name = meta.name
        namespace = meta.namespace
        labels = dict(meta.labels or {})
        annotations = dict(meta.annotations or {})

        status_map = {}
        for cs in (pod_obj.status.container_statuses or []):
            status_map[cs.name] = cs

        containers = []
        for c in (pod_obj.spec.containers or []):
            cs = status_map.get(c.name)
            ports = [p.container_port for p in (c.ports or [])]
            containers.append(ContainerInfo(
                name=c.name,
                image=c.image,
                ports=ports,
                ready=cs.ready if cs else False,
                restart_count=cs.restart_count if cs else 0,
            ))

        ready = bool(containers) and all(ci.ready for ci in containers)
        total_restarts = sum(ci.restart_count for ci in containers)

        phase_str = pod_obj.status.phase or "Unknown"
        try:
            phase = PodPhase(phase_str)
        except ValueError:
            phase = PodPhase.UNKNOWN

        return GraphNode(
            id=f"pod/{namespace}/{name}",
            type=NodeType.POD,
            label=name,
            namespace=namespace,
            data=PodData(
                phase=phase,
                pod_ip=pod_obj.status.pod_ip,
                host_ip=pod_obj.status.host_ip,
                node_name=pod_obj.spec.node_name,
                labels=labels,
                annotations=annotations,
                containers=containers,
                ready=ready,
                restart_count=total_restarts,
            ),
        )

    def _build_service_node(self, svc_obj) -> GraphNode:
        meta = svc_obj.metadata
        name = meta.name
        namespace = meta.namespace
        spec = svc_obj.spec

        try:
            svc_type = ServiceType(spec.type or "ClusterIP")
        except ValueError:
            svc_type = ServiceType.CLUSTER_IP

        ports = []
        for p in (spec.ports or []):
            ports.append(ServicePort(
                name=p.name,
                port=p.port,
                target_port=p.target_port,
                protocol=p.protocol or "TCP",
                node_port=p.node_port,
            ))

        lb_ip = None
        if svc_obj.status.load_balancer and svc_obj.status.load_balancer.ingress:
            first = svc_obj.status.load_balancer.ingress[0]
            lb_ip = first.ip or first.hostname

        return GraphNode(
            id=f"svc/{namespace}/{name}",
            type=NodeType.SERVICE,
            label=name,
            namespace=namespace,
            data=ServiceData(
                service_type=svc_type,
                cluster_ip=spec.cluster_ip,
                external_ips=list(spec.external_i_ps or []),
                selector=dict(spec.selector or {}),
                ports=ports,
                load_balancer_ip=lb_ip,
            ),
        )

    def _build_ingress_node(self, ing_obj) -> GraphNode:
        meta = ing_obj.metadata
        name = meta.name
        namespace = meta.namespace
        annotations = dict(meta.annotations or {})
        spec = ing_obj.spec

        ingress_class = spec.ingress_class_name or annotations.get("kubernetes.io/ingress.class")

        rules = []
        for rule in (spec.rules or []):
            paths = []
            if rule.http:
                for p in (rule.http.paths or []):
                    svc_name = None
                    svc_port = None
                    if p.backend and p.backend.service:
                        svc_name = p.backend.service.name
                        if p.backend.service.port:
                            svc_port = p.backend.service.port.number or p.backend.service.port.name
                    if svc_name:
                        paths.append(IngressPath(
                            path=p.path,
                            path_type=p.path_type,
                            service_name=svc_name,
                            service_port=svc_port or 80,
                        ))
            rules.append(IngressRule(host=rule.host, paths=paths))

        tls_hosts = []
        for tls in (spec.tls or []):
            tls_hosts.extend(tls.hosts or [])

        lb_ip = None
        if ing_obj.status.load_balancer and ing_obj.status.load_balancer.ingress:
            first = ing_obj.status.load_balancer.ingress[0]
            lb_ip = first.ip or first.hostname

        return GraphNode(
            id=f"ingress/{namespace}/{name}",
            type=NodeType.INGRESS,
            label=name,
            namespace=namespace,
            data=IngressData(
                ingress_class=ingress_class,
                rules=rules,
                tls_hosts=tls_hosts,
                load_balancer_ip=lb_ip,
            ),
        )

    def _build_network_policy_node(self, np_obj) -> GraphNode:
        meta = np_obj.metadata
        name = meta.name
        namespace = meta.namespace
        spec = np_obj.spec

        pod_selector = dict((spec.pod_selector.match_labels or {}) if spec.pod_selector else {})
        policy_types = list(spec.policy_types or [])

        def _map_peers(peer_list):
            peers = []
            for p in (peer_list or []):
                ip_block = p.ip_block.cidr if p.ip_block else None
                peers.append(NetworkPolicyPeer(
                    pod_selector=dict((p.pod_selector.match_labels or {}) if p.pod_selector else {}),
                    namespace_selector=dict((p.namespace_selector.match_labels or {}) if p.namespace_selector else {}),
                    ip_block=ip_block,
                ))
            return peers

        def _map_ports(port_list):
            return [
                NetworkPolicyPort(protocol=p.protocol or "TCP", port=p.port)
                for p in (port_list or [])
            ]

        ingress_rules = []
        for rule in (spec.ingress or []):
            from_peers = getattr(rule, "_from", None) or []
            ingress_rules.append(NetworkPolicyRule(
                ports=_map_ports(rule.ports),
                peers=_map_peers(from_peers),
            ))

        egress_rules = []
        for rule in (spec.egress or []):
            egress_rules.append(NetworkPolicyRule(
                ports=_map_ports(rule.ports),
                peers=_map_peers(rule.to or []),
            ))

        return GraphNode(
            id=f"netpol/{namespace}/{name}",
            type=NodeType.NETWORK_POLICY,
            label=name,
            namespace=namespace,
            data=NetworkPolicyData(
                pod_selector=pod_selector,
                policy_types=policy_types,
                ingress_rules=ingress_rules,
                egress_rules=egress_rules,
            ),
        )

    def _label_selector_matches(self, selector: dict, labels: dict) -> bool:
        if not selector:
            return False
        return all(labels.get(k) == v for k, v in selector.items())

    def _make_edge(self, edge_type, source_id, target_id, data=None) -> GraphEdge:
        return GraphEdge(
            id=f"{source_id}→{target_id}",
            type=edge_type,
            source=source_id,
            target=target_id,
            data=data or EdgeData(),
        )

    def _derive_edges_for_pod(self, pod_node: GraphNode) -> list:
        edges = []
        pod_data = pod_node.data
        ns = pod_node.namespace

        ns_node_id = f"namespace/{ns}"
        if self.graph.get_node(ns_node_id):
            edges.append(self._make_edge(EdgeType.POD_TO_NAMESPACE, pod_node.id, ns_node_id))

        if pod_data.node_name:
            cluster_node_id = f"node/{pod_data.node_name}"
            if self.graph.get_node(cluster_node_id):
                edges.append(self._make_edge(EdgeType.POD_TO_NODE, pod_node.id, cluster_node_id))

        pod_labels = pod_data.labels
        for svc_node in self.graph.nodes_by_type(NodeType.SERVICE):
            if svc_node.namespace != ns:
                continue
            if self._label_selector_matches(svc_node.data.selector, pod_labels):
                edges.append(self._make_edge(EdgeType.SERVICE_SELECTS_POD, svc_node.id, pod_node.id))

        return edges

    def _derive_edges_for_service(self, svc_node: GraphNode) -> list:
        edges = []
        ns = svc_node.namespace
        selector = svc_node.data.selector

        for pod_node in self.graph.nodes_by_type(NodeType.POD):
            if pod_node.namespace != ns:
                continue
            if self._label_selector_matches(selector, pod_node.data.labels):
                edges.append(self._make_edge(EdgeType.SERVICE_SELECTS_POD, svc_node.id, pod_node.id))

        svc_name = svc_node.label
        for ing_node in self.graph.nodes_by_type(NodeType.INGRESS):
            if ing_node.namespace != ns:
                continue
            matched_ports = []
            for rule in ing_node.data.rules:
                for path in rule.paths:
                    if path.service_name == svc_name and isinstance(path.service_port, int):
                        matched_ports.append(path.service_port)
            if matched_ports:
                edges.append(self._make_edge(
                    EdgeType.INGRESS_TO_SERVICE,
                    ing_node.id,
                    svc_node.id,
                    EdgeData(ports=matched_ports),
                ))

        return edges

    def _derive_edges_for_ingress(self, ing_node: GraphNode) -> list:
        edges = []
        ns = ing_node.namespace
        seen: dict[str, list] = {}

        for rule in ing_node.data.rules:
            for path in rule.paths:
                svc_id = f"svc/{ns}/{path.service_name}"
                if self.graph.get_node(svc_id):
                    port = path.service_port if isinstance(path.service_port, int) else None
                    if svc_id not in seen:
                        seen[svc_id] = []
                    if port:
                        seen[svc_id].append(port)

        for svc_id, ports in seen.items():
            edges.append(self._make_edge(
                EdgeType.INGRESS_TO_SERVICE,
                ing_node.id,
                svc_id,
                EdgeData(ports=ports),
            ))

        return edges

    def _namespaces_matching_selector(self, selector: dict[str, str]) -> list[str]:
        if not selector:
            return [
                n.label for n in self.graph.nodes
                if n.type == NodeType.NAMESPACE
            ]
        matching = []
        for n in self.graph.nodes:
            if n.type != NodeType.NAMESPACE:
                continue
            ns_labels = dict(n.data.labels)
            if "kubernetes.io/metadata.name" not in ns_labels:
                ns_labels["kubernetes.io/metadata.name"] = n.label
            if "name" not in ns_labels:
                ns_labels["name"] = n.label
            if self._label_selector_matches(selector, ns_labels):
                matching.append(n.label)
        return matching

    def _derive_edges_for_network_policy(self, np_node: GraphNode) -> list[GraphEdge]:
        np_data: NetworkPolicyData = np_node.data
        namespace = np_node.namespace
        edges = []

        selected_pods = [
            n for n in self.graph.nodes
            if n.type == NodeType.POD
            and n.namespace == namespace
            and (
                not np_data.pod_selector
                or self._label_selector_matches(np_data.pod_selector, n.data.labels)
            )
        ]

        for selected_pod in selected_pods:
            edges.append(GraphEdge(
                id=f"{np_node.id}\u2192{selected_pod.id}",
                type=EdgeType.NETPOL_SELECTS_POD,
                source=np_node.id,
                target=selected_pod.id,
            ))

        for rule in np_data.ingress_rules:
            ports = [p.port for p in rule.ports if p.port is not None]
            protocols = [p.protocol for p in rule.ports]
            edge_data = EdgeData(
                ports=[p for p in ports if isinstance(p, int)],
                protocols=protocols,
            )

            for peer in rule.peers:
                if peer.ip_block:
                    continue

                if peer.namespace_selector:
                    peer_namespaces = self._namespaces_matching_selector(
                        peer.namespace_selector
                    )
                else:
                    peer_namespaces = [namespace]

                peer_pods = [
                    n for n in self.graph.nodes
                    if n.type == NodeType.POD
                    and n.namespace in peer_namespaces
                    and (
                        not peer.pod_selector
                        or self._label_selector_matches(peer.pod_selector, n.data.labels)
                    )
                ]

                for peer_pod in peer_pods:
                    for selected_pod in selected_pods:
                        if peer_pod.id == selected_pod.id:
                            continue
                        edges.append(GraphEdge(
                            id=f"{peer_pod.id}\u2192{selected_pod.id}__netpol_ingress__{np_node.id}",
                            type=EdgeType.NETPOL_ALLOWS_INGRESS,
                            source=peer_pod.id,
                            target=selected_pod.id,
                            data=edge_data,
                        ))

        for rule in np_data.egress_rules:
            ports = [p.port for p in rule.ports if p.port is not None]
            protocols = [p.protocol for p in rule.ports]
            edge_data = EdgeData(
                ports=[p for p in ports if isinstance(p, int)],
                protocols=protocols,
            )

            for peer in rule.peers:
                if peer.ip_block:
                    continue

                if peer.namespace_selector:
                    peer_namespaces = self._namespaces_matching_selector(
                        peer.namespace_selector
                    )
                else:
                    peer_namespaces = [namespace]

                peer_pods = [
                    n for n in self.graph.nodes
                    if n.type == NodeType.POD
                    and n.namespace in peer_namespaces
                    and (
                        not peer.pod_selector
                        or self._label_selector_matches(peer.pod_selector, n.data.labels)
                    )
                ]

                for selected_pod in selected_pods:
                    for peer_pod in peer_pods:
                        if selected_pod.id == peer_pod.id:
                            continue
                        edges.append(GraphEdge(
                            id=f"{selected_pod.id}\u2192{peer_pod.id}__netpol_egress__{np_node.id}",
                            type=EdgeType.NETPOL_ALLOWS_EGRESS,
                            source=selected_pod.id,
                            target=peer_pod.id,
                            data=edge_data,
                        ))

        return edges

    def _derive_all_edges(self):
        self.graph.edges.clear()
        self.graph._edge_index.clear()

        for node in list(self.graph.nodes):
            if node.type == NodeType.POD:
                new_edges = self._derive_edges_for_pod(node)
            elif node.type == NodeType.SERVICE:
                new_edges = self._derive_edges_for_service(node)
            elif node.type == NodeType.INGRESS:
                new_edges = self._derive_edges_for_ingress(node)
            elif node.type == NodeType.NETWORK_POLICY:
                new_edges = self._derive_edges_for_network_policy(node)
            else:
                continue
            for edge in new_edges:
                self.graph.upsert_edge(edge)

    def _recompute_edges_for_node(self, node: GraphNode):
        existing_edges = self.graph.edges_for_node(node.id)
        edge_ids_removed = [e.id for e in existing_edges]
        for eid in edge_ids_removed:
            self.graph.remove_edge(eid)

        if node.type == NodeType.POD:
            new_edges = self._derive_edges_for_pod(node)
        elif node.type == NodeType.SERVICE:
            new_edges = self._derive_edges_for_service(node)
        elif node.type == NodeType.INGRESS:
            new_edges = self._derive_edges_for_ingress(node)
        elif node.type == NodeType.NETWORK_POLICY:
            new_edges = self._derive_edges_for_network_policy(node)
        else:
            new_edges = []

        for edge in new_edges:
            self.graph.upsert_edge(edge)

        return new_edges, edge_ids_removed
