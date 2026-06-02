from __future__ import annotations
from enum import Enum
from pydantic import BaseModel, Field
from datetime import datetime, timezone


class WorkloadHealth(str, Enum):
    HEALTHY     = "healthy"
    DEGRADED    = "degraded"
    UNAVAILABLE = "unavailable"
    SCALED_DOWN = "scaled_down"


class ContainerSpec(BaseModel):
    name           : str
    image          : str
    cpu_request    : str | None = None
    memory_request : str | None = None
    cpu_limit      : str | None = None
    memory_limit   : str | None = None
    ports          : list[int] = []


class PodSummary(BaseModel):
    name          : str
    phase         : str
    pod_ip        : str | None = None
    node_name     : str | None = None
    restart_count : int = 0
    ready         : bool = False
    created_at    : str | None = None


class DeploymentItem(BaseModel):
    name               : str
    namespace          : str
    desired_replicas   : int
    ready_replicas     : int
    available_replicas : int
    updated_replicas   : int
    strategy           : str
    selector           : dict[str, str] = {}
    containers         : list[ContainerSpec] = []
    created_at         : str | None = None
    health             : WorkloadHealth
    total_restarts     : int = 0
    pods               : list[PodSummary] = []


class StatefulSetItem(BaseModel):
    name             : str
    namespace        : str
    desired_replicas : int
    ready_replicas   : int
    current_replicas : int
    selector         : dict[str, str] = {}
    containers       : list[ContainerSpec] = []
    created_at       : str | None = None
    health           : WorkloadHealth
    total_restarts   : int = 0
    pods             : list[PodSummary] = []
    service_name     : str | None = None


class DaemonSetItem(BaseModel):
    name                   : str
    namespace              : str
    desired_number_scheduled: int
    number_ready           : int
    number_available       : int
    number_misscheduled    : int
    selector               : dict[str, str] = {}
    containers             : list[ContainerSpec] = []
    created_at             : str | None = None
    health                 : WorkloadHealth
    total_restarts         : int = 0
    pods                   : list[PodSummary] = []


class WorkloadSummary(BaseModel):
    total       : int = 0
    healthy     : int = 0
    degraded    : int = 0
    unavailable : int = 0
    scaled_down : int = 0


class DeploymentListResponse(BaseModel):
    items   : list[DeploymentItem]
    summary : WorkloadSummary


class StatefulSetListResponse(BaseModel):
    items   : list[StatefulSetItem]
    summary : WorkloadSummary


class DaemonSetListResponse(BaseModel):
    items   : list[DaemonSetItem]
    summary : WorkloadSummary


class JobStatus(str, Enum):
    COMPLETE  = "complete"
    RUNNING   = "running"
    FAILED    = "failed"
    SUSPENDED = "suspended"


class JobItem(BaseModel):
    name             : str
    namespace        : str
    completions      : int                  # spec.completions or 1
    succeeded        : int = 0
    active           : int = 0
    failed           : int = 0
    status           : JobStatus
    start_time       : str | None = None
    completion_time  : str | None = None
    duration         : str | None = None    # "2m 34s" | "45s" | "running Xm"
    parallelism      : int = 1
    created_at       : str | None = None
    pods             : list[PodSummary] = []
    owner_cronjob    : str | None = None    # name of owning CronJob if any


class JobListResponse(BaseModel):
    items   : list[JobItem]
    summary : WorkloadSummary


class CronJobItem(BaseModel):
    name                          : str
    namespace                     : str
    schedule                      : str
    suspended                     : bool = False
    active_jobs                   : int = 0
    last_schedule_time            : str | None = None
    last_successful_time          : str | None = None
    next_schedule_time            : str | None = None   # ISO timestamp
    next_schedule_relative        : str | None = None   # "in 2h 34m"
    concurrency_policy            : str = "Allow"
    successful_jobs_history_limit : int = 3
    failed_jobs_history_limit     : int = 1
    created_at                    : str | None = None
    recent_jobs                   : list[JobItem] = []


class CronJobListResponse(BaseModel):
    items : list[CronJobItem]



class KubeEvent(BaseModel):
    uid        : str
    type       : str
    reason     : str
    message    : str
    count      : int = 1
    first_time : str | None = None
    last_time  : str | None = None
    regarding  : str


class EventsResponse(BaseModel):
    events : list[KubeEvent]


class ConnectedPodGroup(BaseModel):
    label         : str
    replica_count : int
    pods          : list[PodSummary]
    host_nodes    : list[str]


class ConnectedService(BaseModel):
    name         : str
    namespace    : str
    cluster_ip   : str | None = None
    service_type : str
    ports        : list[dict] = []


class ConnectedIngress(BaseModel):
    name          : str
    namespace     : str
    ingress_class : str | None = None
    hosts         : list[str] = []


class ConnectedNetworkPolicy(BaseModel):
    name         : str
    namespace    : str
    policy_types : list[str]
    summary      : str


class ConnectedConfigMap(BaseModel):
    name       : str
    namespace  : str
    mount_type : str
    keys       : list[str]


class ConnectedSecret(BaseModel):
    name        : str
    namespace   : str
    mount_type  : str
    keys        : list[str]
    secret_type : str


class ConnectedServiceAccount(BaseModel):
    name      : str
    namespace : str


class ConnectedNode(BaseModel):
    name        : str
    internal_ip : str | None = None
    roles       : list[str]
    ready       : bool


class DeploymentMap(BaseModel):
    deployment_name  : str
    namespace        : str
    desired_replicas : int
    ready_replicas   : int
    health           : WorkloadHealth
    pod_groups       : list[ConnectedPodGroup]
    nodes            : list[ConnectedNode]
    services         : list[ConnectedService]
    ingresses        : list[ConnectedIngress]
    network_policies : list[ConnectedNetworkPolicy]
    config_maps      : list[ConnectedConfigMap]
    secrets          : list[ConnectedSecret]
    service_account  : ConnectedServiceAccount | None = None


class NamespaceWorkload(BaseModel):
    kind         : str
    name         : str
    namespace    : str
    health       : WorkloadHealth
    ready_string : str
    pod_group    : ConnectedPodGroup
    service_names: list[str] = []


class NamespaceMapSummary(BaseModel):
    workloads       : int = 0
    pods            : int = 0
    services        : int = 0
    ingresses       : int = 0
    network_policies: int = 0
    config_maps     : int = 0
    secrets         : int = 0
    service_accounts: int = 0


class NamespaceMap(BaseModel):
    namespace        : str
    workloads        : list[NamespaceWorkload]
    services         : list[ConnectedService]
    ingresses        : list[ConnectedIngress]
    network_policies : list[ConnectedNetworkPolicy]
    config_maps      : list[ConnectedConfigMap]
    secrets          : list[ConnectedSecret]
    service_accounts : list[ConnectedServiceAccount]
    nodes            : list[ConnectedNode]
    summary          : NamespaceMapSummary
