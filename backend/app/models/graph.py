from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Annotated, Any, Literal, Union

from pydantic import BaseModel, Field

def _now() -> datetime:
    return datetime.now(timezone.utc)


class NodeType(str, Enum):
    NAMESPACE      = "namespace"
    CLUSTER_NODE   = "cluster_node"
    POD            = "pod"
    SERVICE        = "service"
    INGRESS        = "ingress"
    NETWORK_POLICY = "network_policy"


class EdgeType(str, Enum):
    POD_TO_NODE      = "pod_to_node"       # pod.spec.nodeName → Node
    POD_TO_NAMESPACE = "pod_to_namespace"  # pod belongs to namespace

    SERVICE_SELECTS_POD  = "service_selects_pod"   # svc.spec.selector ∩ pod labels
    INGRESS_TO_SERVICE   = "ingress_to_service"    # ingress backend.service

    NETPOL_SELECTS_POD    = "netpol_selects_pod"    # policy applies to pod
    NETPOL_ALLOWS_INGRESS = "netpol_allows_ingress" # allowed inbound traffic
    NETPOL_ALLOWS_EGRESS  = "netpol_allows_egress"  # allowed outbound traffic


class PodPhase(str, Enum):
    PENDING   = "Pending"
    RUNNING   = "Running"
    SUCCEEDED = "Succeeded"
    FAILED    = "Failed"
    UNKNOWN   = "Unknown"


class ServiceType(str, Enum):
    CLUSTER_IP    = "ClusterIP"
    NODE_PORT     = "NodePort"
    LOAD_BALANCER = "LoadBalancer"
    EXTERNAL_NAME = "ExternalName"


class WatchEventType(str, Enum):
    ADDED     = "ADDED"
    MODIFIED  = "MODIFIED"
    DELETED   = "DELETED"
    FULL_SYNC = "FULL_SYNC"


class ServicePort(BaseModel):
    name        : str | None = None
    port        : int
    target_port : int | str
    protocol    : str = "TCP"
    node_port   : int | None = None


class ContainerInfo(BaseModel):
    name          : str
    image         : str
    ports         : list[int] = []
    ready         : bool = False
    restart_count : int  = 0


class IngressPath(BaseModel):
    path         : str | None = None
    path_type    : str | None = None
    service_name : str
    service_port : int | str


class IngressRule(BaseModel):
    host  : str | None = None
    paths : list[IngressPath] = []


class NetworkPolicyPort(BaseModel):
    protocol : str = "TCP"
    port     : int | str | None = None


class NetworkPolicyPeer(BaseModel):
    pod_selector       : dict[str, str] = {}
    namespace_selector : dict[str, str] = {}
    ip_block           : str | None = None


class NetworkPolicyRule(BaseModel):
    ports : list[NetworkPolicyPort] = []
    peers : list[NetworkPolicyPeer] = []


class NamespaceData(BaseModel):
    kind        : Literal["namespace"] = "namespace"
    status      : str
    labels      : dict[str, str] = {}
    annotations : dict[str, str] = {}


class ClusterNodeData(BaseModel):
    kind              : Literal["cluster_node"] = "cluster_node"
    roles             : list[str]               
    internal_ip       : str | None = None
    external_ip       : str | None = None
    os_image          : str | None = None
    kernel_version    : str | None = None
    container_runtime : str | None = None
    ready             : bool = False
    cpu_capacity      : str | None = None
    memory_capacity   : str | None = None
    labels            : dict[str, str] = {}
    taints            : list[dict[str, Any]] = []


class PodData(BaseModel):
    kind          : Literal["pod"] = "pod"
    phase         : PodPhase = PodPhase.UNKNOWN
    pod_ip        : str | None = None
    host_ip       : str | None = None
    node_name     : str | None = None
    labels        : dict[str, str] = {}
    annotations   : dict[str, str] = {}
    containers    : list[ContainerInfo] = []
    ready         : bool = False
    restart_count : int  = 0


class ServiceData(BaseModel):
    kind             : Literal["service"] = "service"
    service_type     : ServiceType = ServiceType.CLUSTER_IP
    cluster_ip       : str | None = None
    external_ips     : list[str] = []
    selector         : dict[str, str] = {}
    ports            : list[ServicePort] = []
    load_balancer_ip : str | None = None


class IngressData(BaseModel):
    kind             : Literal["ingress"] = "ingress"
    ingress_class    : str | None = None
    rules            : list[IngressRule] = []
    tls_hosts        : list[str] = []
    load_balancer_ip : str | None = None


class NetworkPolicyData(BaseModel):
    kind          : Literal["network_policy"] = "network_policy"
    pod_selector  : dict[str, str] = {}          
    policy_types  : list[str] = []               
    ingress_rules : list[NetworkPolicyRule] = []
    egress_rules  : list[NetworkPolicyRule] = []


NodeData = Annotated[
    Union[
        NamespaceData,
        ClusterNodeData,
        PodData,
        ServiceData,
        IngressData,
        NetworkPolicyData,
    ],
    Field(discriminator="kind"),
]

class GraphNode(BaseModel):
    id        : str            
    type      : NodeType
    label     : str            
    namespace : str | None = None   
    data      : NodeData


class EdgeData(BaseModel):
    ports       : list[int] = []
    protocols   : list[str] = []
    description : str | None = None


class GraphEdge(BaseModel):
    id     : str
    type   : EdgeType
    source : str       
    target : str       
    data   : EdgeData = Field(default_factory=EdgeData)

class ClusterInfo(BaseModel):
    server_version  : str | None = None
    platform        : str | None = None
    node_count      : int = 0
    namespace_count : int = 0


class Graph(BaseModel):
    nodes        : list[GraphNode] = Field(default_factory=list)
    edges        : list[GraphEdge] = Field(default_factory=list)
    generated_at : datetime = Field(default_factory=_now)
    cluster_info : ClusterInfo = Field(default_factory=ClusterInfo)

    model_config = {"arbitrary_types_allowed": True}

    def model_post_init(self, __context: Any) -> None:
        self._node_index: dict[str, GraphNode] = {n.id: n for n in self.nodes}
        self._edge_index: dict[str, GraphEdge] = {e.id: e for e in self.edges}


    def get_node(self, node_id: str) -> GraphNode | None:
        return self._node_index.get(node_id)

    def get_edge(self, edge_id: str) -> GraphEdge | None:
        return self._edge_index.get(edge_id)

    def edges_for_node(self, node_id: str) -> list[GraphEdge]:
        """Return all edges where node is source or target."""
        return [e for e in self.edges if e.source == node_id or e.target == node_id]

    def nodes_by_type(self, node_type: NodeType) -> list[GraphNode]:
        return [n for n in self.nodes if n.type == node_type]

    def nodes_by_namespace(self, namespace: str) -> list[GraphNode]:
        return [n for n in self.nodes if n.namespace == namespace]

    def upsert_node(self, node: GraphNode) -> None:
        if node.id in self._node_index:
            idx = next(i for i, n in enumerate(self.nodes) if n.id == node.id)
            self.nodes[idx] = node
        else:
            self.nodes.append(node)
        self._node_index[node.id] = node

    def remove_node(self, node_id: str) -> GraphNode | None:
        node = self._node_index.pop(node_id, None)
        if node is None:
            return None
        self.nodes = [n for n in self.nodes if n.id != node_id]
        # Cascade-remove orphaned edges
        orphans = [e.id for e in self.edges if e.source == node_id or e.target == node_id]
        for eid in orphans:
            self.remove_edge(eid)
        return node

    def upsert_edge(self, edge: GraphEdge) -> None:
        if edge.id in self._edge_index:
            idx = next(i for i, e in enumerate(self.edges) if e.id == edge.id)
            self.edges[idx] = edge
        else:
            self.edges.append(edge)
        self._edge_index[edge.id] = edge

    def remove_edge(self, edge_id: str) -> GraphEdge | None:
        edge = self._edge_index.pop(edge_id, None)
        if edge is None:
            return None
        self.edges = [e for e in self.edges if e.id != edge_id]
        return edge

    def clear(self) -> None:
        self.nodes.clear()
        self.edges.clear()
        self._node_index.clear()
        self._edge_index.clear()


class GraphDelta(BaseModel):
    event       : WatchEventType
    timestamp   : datetime = Field(default_factory=_now)

    node          : GraphNode | None = None
    edges_added   : list[GraphEdge] = []
    edges_removed : list[str] = []
    node_id : str | None = None

    graph : Graph | None = None


class Snapshot(BaseModel):
    version     : str = "1.0"
    exported_at : datetime = Field(default_factory=_now)
    cluster_info: ClusterInfo
    graph       : Graph