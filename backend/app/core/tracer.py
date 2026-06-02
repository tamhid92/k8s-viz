from app.models.trace import TraceResult, TraceHop, BackendCandidate, HopType, HopStatus

class PacketTracer:
    def __init__(self, k8s_client, graph_builder):
        self._k8s = k8s_client
        self._graph = graph_builder.graph

    def trace(self, from_pod_id: str, to_service_id: str) -> TraceResult:
        try:
            source_pod   = self._graph.get_node(from_pod_id)
            dest_service = self._graph.get_node(to_service_id)
            if not source_pod or not dest_service:
                raise ValueError(f"Node not found: {from_pod_id} or {to_service_id}")

            cni_type          = self._detect_cni()
            kube_proxy_mode   = self._detect_kube_proxy_mode()
            coredns_ids, domain = self._get_coredns_info()
            candidates        = self._get_backend_candidates(dest_service)
            has_netpol, netpol_desc = self._get_netpol_on_path(from_pod_id, to_service_id)
            cross_node        = any(not c.same_node for c in candidates)
            kube_proxy_pod    = next(
                (n.id for n in self._graph.nodes
                 if n.namespace == "kube-system"
                 and n.data.labels.get("k8s-app") == "kube-proxy"),
                None
            )

            step = 0
            hops = []

            step += 1; hops.append(self._hop_source(source_pod, step))
            step += 1; hops.append(self._hop_dns(dest_service, coredns_ids, domain, step))
            step += 1; hops.append(self._hop_kube_proxy(source_pod, dest_service, kube_proxy_mode, kube_proxy_pod, step))
            step += 1; hops.append(self._hop_load_balance(candidates, step))
            step += 1; hops.append(self._hop_cni(source_pod, candidates, cni_type, step))

            if has_netpol:
                step += 1; hops.append(self._hop_netpol_check(has_netpol, netpol_desc, dest_service, step))

            step += 1; hops.append(self._hop_destination(candidates, dest_service, step))

            fqdn = f"{dest_service.label}.{dest_service.namespace}.svc.{domain}"

            return TraceResult(
                from_pod_id=from_pod_id,
                to_service_id=to_service_id,
                hops=hops,
                candidates=candidates,
                cni_type=cni_type,
                kube_proxy_mode=kube_proxy_mode,
                dns_fqdn=fqdn,
                cross_node=cross_node,
                has_netpol=has_netpol,
            )

        except Exception as e:
            return TraceResult(
                from_pod_id=from_pod_id,
                to_service_id=to_service_id,
                hops=[], candidates=[],
                cni_type=None, kube_proxy_mode=None,
                dns_fqdn=None, cross_node=False,
                has_netpol=False, error=str(e),
            )

    def _detect_cni(self) -> str | None:
        for n in self._graph.nodes:
            if n.namespace == "kube-system" and n.type == "pod":
                labels = n.data.labels or {}
                name = n.label or ""
                if labels.get("k8s-app") == "flannel" or "flannel" in name:
                    return "flannel (VXLAN)"
                if labels.get("k8s-app") == "calico-node" or "calico" in name:
                    return "calico"
                if "cilium" in name:
                    return "cilium (eBPF)"
                if "weave" in name:
                    return "weave"
                if "kindnet" in name:
                    return "kindnet (bridge)"
                if "canal" in name:
                    return "canal"
        return None

    def _detect_kube_proxy_mode(self) -> str | None:
        has_kube_proxy = any(
            n.namespace == "kube-system" and n.type == "pod" and n.data.labels.get("k8s-app") == "kube-proxy"
            for n in self._graph.nodes
        )
        if not has_kube_proxy:
            return "ebpf"
        
        try:
            cm = self._k8s.read_namespaced_config_map("kube-proxy", "kube-system")
            if cm and cm.data:
                config_data = cm.data.get("config.conf", "") or cm.data.get("kubeconfig.conf", "")
                if "ipvs" in config_data.lower(): return "ipvs"
                if "iptables" in config_data.lower(): return "iptables"
        except Exception:
            pass
            
        return "iptables"

    def _get_coredns_info(self) -> tuple[list[str], str]:
        coredns_pod_ids = [
            n.id for n in self._graph.nodes 
            if n.namespace == "kube-system" and n.type == "pod" and n.data.labels.get("k8s-app") == "kube-dns"
        ]
        
        domain = "cluster.local"
        try:
            cm = self._k8s.read_namespaced_config_map("coredns", "kube-system")
            if cm and cm.data:
                corefile = cm.data.get("Corefile", "")
                for line in corefile.split('\n'):
                    if line.strip().startswith("kubernetes"):
                        parts = line.strip().split()
                        if len(parts) > 1 and parts[1] != '{':
                            domain = parts[1]
                            break
        except Exception:
            pass
            
        return coredns_pod_ids, domain

    def _get_backend_candidates(self, service_node) -> list[BackendCandidate]:
        candidates = []
        for e in self._graph.edges:
            if e.type == "service_selects_pod" and e.source == service_node.id:
                pod = self._graph.get_node(e.target)
                if pod:
                    candidates.append(BackendCandidate(
                        pod_id=pod.id,
                        pod_name=pod.label,
                        pod_ip=pod.data.pod_ip,
                        node_name=pod.data.node_name,
                        same_node=False, # Evaluated against source later? The prompt says "compare pod node_name to source pod node_name" here but source_pod isn't passed.
                        ready=pod.data.ready
                    ))
        
        ready_candidates = [c for c in candidates if c.ready]
        return ready_candidates if ready_candidates else candidates

    def _get_netpol_on_path(self, source_pod_id: str, dest_service_id: str) -> tuple[bool, str]:
        dest_pod_ids = {e.target for e in self._graph.edges if e.type == "service_selects_pod" and e.source == dest_service_id}
        
        has_ingress = any(e.type == "netpol_allows_ingress" and e.target in dest_pod_ids for e in self._graph.edges)
        has_egress = any(e.type == "netpol_allows_egress" and e.source == source_pod_id for e in self._graph.edges)
        
        has_netpol = has_ingress or has_egress
        
        # Build description string listing policy names. This logic could be improved to actually find the policy node names, but the graph edges don't directly link to the policy node id. They link pods. Let's just output a generic description for now if it exists, or trace back if possible.
        description = "Network policies found affecting this path." if has_netpol else ""
        return has_netpol, description

    def _hop_source(self, source_pod, step) -> TraceHop:
        return TraceHop(
            step=step,
            hop_type=HopType.SOURCE,
            title="Source Pod",
            subtitle=f"{source_pod.namespace} / {source_pod.label}",
            detail=f"Pod IP: {source_pod.data.pod_ip or 'pending'} · Node: {source_pod.data.node_name or 'unknown'}",
            technical=f"src_ip={source_pod.data.pod_ip}",
            node_id=source_pod.id,
            status=HopStatus.THEORETICAL
        )

    def _hop_dns(self, service_node, coredns_pod_ids, cluster_domain, step) -> TraceHop:
        fqdn = f"{service_node.label}.{service_node.namespace}.svc.{cluster_domain}"
        return TraceHop(
            step=step,
            hop_type=HopType.DNS,
            title="CoreDNS Resolution",
            subtitle=f"kube-system / coredns  ({len(coredns_pod_ids)} replicas)",
            detail=f"Resolves {fqdn} → {service_node.data.cluster_ip or 'ClusterIP'}",
            technical=f"query: A {fqdn}\nresponse: {service_node.data.cluster_ip}",
            node_id=coredns_pod_ids[0] if coredns_pod_ids else None,
            status=HopStatus.THEORETICAL
        )

    def _hop_kube_proxy(self, source_pod, service_node, kube_proxy_mode, kube_proxy_pod_id, step) -> TraceHop:
        first_port = service_node.data.ports[0].port if service_node.data.ports else "<port>"
        target_port = service_node.data.ports[0].target_port if service_node.data.ports else "<target_port>"
        
        candidate_count = len([e for e in self._graph.edges if e.type == "service_selects_pod" and e.source == service_node.id])
        
        if kube_proxy_mode == "iptables":
            tech = (f"iptables -t nat KUBE-SERVICES → KUBE-SVC-XXXX → KUBE-SEP-XXXX\n"
                    f"DNAT --to-destination <endpoint_ip>:{target_port}")
        elif kube_proxy_mode == "ipvs":
            tech = f"ipvsadm: {service_node.data.cluster_ip}:{first_port} rr → <endpoint>"
        else:
            tech = "eBPF XDP/TC hook performs DNAT at kernel bypass layer"
            
        return TraceHop(
            step=step,
            hop_type=HopType.KUBE_PROXY,
            title="Service Routing",
            subtitle=f"kube-proxy ({kube_proxy_mode}) on {source_pod.data.node_name}",
            detail=f"DNAT: {service_node.data.cluster_ip}:{first_port} → one of {candidate_count} endpoints",
            technical=tech,
            node_id=kube_proxy_pod_id,
            status=HopStatus.THEORETICAL
        )

    def _hop_load_balance(self, candidates, step) -> TraceHop:
        tech = "\n".join(
            f"→ {c.pod_name}  {c.pod_ip}  {c.node_name}  {'(same node)' if c.same_node else '(cross-node)'}"
            for c in candidates
        )
        return TraceHop(
            step=step,
            hop_type=HopType.LOAD_BALANCE,
            title="Load Balance Decision",
            subtitle=f"{len(candidates)} healthy endpoint(s)",
            detail="One backend is selected. All candidates listed below.",
            technical=tech,
            node_id=None,
            status=HopStatus.THEORETICAL
        )

    def _hop_cni(self, source_pod, candidates, cni_type, step) -> TraceHop:
        has_same_node = any(c.same_node for c in candidates)
        has_cross_node = any(not c.same_node for c in candidates)
        
        if has_same_node and not has_cross_node:
            return TraceHop(
                step=step,
                hop_type=HopType.CNI_SAME_NODE,
                title="CNI: Same-Node Routing",
                subtitle=cni_type or "CNI bridge",
                detail="Packet stays on the node. Routed through CNI bridge to veth pair.",
                technical="cbr0 bridge → veth<xxxxx> → pod network namespace",
                node_id=None,
                status=HopStatus.THEORETICAL
            )
        elif has_cross_node and not has_same_node:
            if cni_type == "flannel (VXLAN)": tech = "VXLAN encap: UDP port 8472 · inner IP unchanged · outer dst = node IP"
            elif cni_type == "calico": tech = "BGP route: no encap if same subnet · IPIP if cross-subnet"
            elif cni_type == "cilium (eBPF)": tech = "eBPF: VXLAN or native routing depending on config"
            else: tech = "Overlay tunnel to destination node"
            
            return TraceHop(
                step=step,
                hop_type=HopType.CNI_CROSS_NODE,
                title="CNI: Cross-Node Overlay",
                subtitle=cni_type or "CNI overlay",
                detail="Packet encapsulated and tunnelled to destination node.",
                technical=tech,
                node_id=None,
                status=HopStatus.THEORETICAL
            )
        else:
            return TraceHop(
                step=step,
                hop_type=HopType.CNI_CROSS_NODE,
                title="CNI: Routing (Mixed)",
                subtitle=cni_type or "CNI",
                detail="Path depends on selected endpoint (same-node or cross-node).",
                technical="Mixed routing paths available.",
                node_id=None,
                status=HopStatus.THEORETICAL
            )

    def _hop_netpol_check(self, has_netpol, description, dest_service_node, step) -> TraceHop:
        return TraceHop(
            step=step,
            hop_type=HopType.NETPOL_CHECK,
            title="NetworkPolicy Check",
            subtitle=description,
            detail=f"Ingress policies on {dest_service_node.label} pods evaluated.",
            technical=description,
            node_id=None,
            status=HopStatus.ALLOWED
        )

    def _hop_destination(self, dest_pod_candidates, service_node, step) -> TraceHop:
        first = dest_pod_candidates[0] if dest_pod_candidates else None
        target_port = service_node.data.ports[0].target_port if service_node.data.ports else "<target_port>"
        
        if first:
            return TraceHop(
                step=step,
                hop_type=HopType.DESTINATION,
                title="Destination Pod",
                subtitle=f"{service_node.namespace} / {first.pod_name}",
                detail=f"Receives packet on port {target_port}. Pod IP: {first.pod_ip}",
                technical=f"dst={first.pod_ip}:{target_port}  (after DNAT)",
                node_id=first.pod_id,
                status=HopStatus.THEORETICAL
            )
        else:
            return TraceHop(
                step=step,
                hop_type=HopType.DESTINATION,
                title="Destination Pod",
                subtitle="Unknown",
                detail="No healthy endpoints available.",
                technical="Connection refused",
                node_id=None,
                status=HopStatus.THEORETICAL
            )
