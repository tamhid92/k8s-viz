from __future__ import annotations
from enum import Enum
from typing import Literal
from pydantic import BaseModel, Field


class HopType(str, Enum):
    SOURCE             = "source"
    DNS                = "dns"
    KUBE_PROXY         = "kube_proxy"
    LOAD_BALANCE       = "load_balance"
    CNI_SAME_NODE      = "cni_same_node"
    CNI_CROSS_NODE     = "cni_cross_node"
    INGRESS_CONTROLLER = "ingress_controller"
    NETPOL_CHECK       = "netpol_check"
    DESTINATION        = "destination"


class HopStatus(str, Enum):
    THEORETICAL = "theoretical"
    ALLOWED     = "allowed"
    BLOCKED     = "blocked"
    UNKNOWN     = "unknown"


class TraceHop(BaseModel):
    step       : int
    hop_type   : HopType
    title      : str
    subtitle   : str
    detail     : str
    technical  : str
    node_id    : str | None = None
    status     : HopStatus = HopStatus.THEORETICAL


class BackendCandidate(BaseModel):
    pod_id    : str
    pod_name  : str
    pod_ip    : str | None
    node_name : str | None
    same_node : bool
    ready     : bool


class TraceResult(BaseModel):
    from_pod_id  : str
    to_service_id: str
    hops         : list[TraceHop]
    candidates   : list[BackendCandidate]
    cni_type     : str | None
    kube_proxy_mode : str | None
    dns_fqdn     : str | None
    cross_node   : bool
    has_netpol   : bool
    error        : str | None = None
