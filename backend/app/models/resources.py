from __future__ import annotations
from pydantic import BaseModel


class EventItem(BaseModel):
    uid        : str
    type       : str
    reason     : str
    message    : str
    count      : int = 1
    first_time : str | None = None
    last_time  : str | None = None
    regarding  : str
    regarding_namespace: str | None = None
    source_component: str | None = None
    namespace  : str | None = None


class EventsListResponse(BaseModel):
    events: list[EventItem]
    warning_count: int
    total: int


class PolicyRule(BaseModel):
    verbs        : list[str]
    api_groups   : list[str]
    resources    : list[str]
    resource_names: list[str] = []


class RoleItem(BaseModel):
    name       : str
    namespace  : str | None = None
    rules      : list[PolicyRule]
    created_at : str | None = None
    rule_count : int


class RoleListResponse(BaseModel):
    items: list[RoleItem]


class Subject(BaseModel):
    kind      : str
    name      : str
    namespace : str | None = None


class RoleBindingItem(BaseModel):
    name       : str
    namespace  : str | None = None
    role_ref   : str
    role_kind  : str
    subjects   : list[Subject]
    created_at : str | None = None


class RoleBindingListResponse(BaseModel):
    items: list[RoleBindingItem]


class ServiceAccountItem(BaseModel):
    name       : str
    namespace  : str
    secrets    : list[str]
    created_at : str | None = None
    bound_roles: list[str] = []


class ServiceAccountListResponse(BaseModel):
    items: list[ServiceAccountItem]


class ConfigMapItem(BaseModel):
    name       : str
    namespace  : str
    keys       : list[str]
    data       : dict[str, str] = {}
    created_at : str | None = None


class ConfigMapListResponse(BaseModel):
    items: list[ConfigMapItem]


class SecretItem(BaseModel):
    name        : str
    namespace   : str
    secret_type : str
    keys        : list[str]
    created_at  : str | None = None


class SecretListResponse(BaseModel):
    items: list[SecretItem]
