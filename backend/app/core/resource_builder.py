from __future__ import annotations
from app.core.k8s_client import K8sClient
from app.models.resources import (
    EventItem, EventsListResponse,
    PolicyRule, RoleItem, RoleListResponse,
    Subject, RoleBindingItem, RoleBindingListResponse,
    ServiceAccountItem, ServiceAccountListResponse,
    ConfigMapItem, ConfigMapListResponse,
    SecretItem, SecretListResponse
)
import logging

logger = logging.getLogger(__name__)

class ResourceBuilder:
    def __init__(self, k8s_client: K8sClient, resource_cache=None):
        self._k8s = k8s_client
        self._cache = resource_cache

    def _fetch(self, resource_type: str, namespace: str | None, list_fn):
        if self._cache:
            return self._cache.get(resource_type, namespace)
        try:
            from kubernetes.client import ApiClient
            api = ApiClient()
            return [api.sanitize_for_serialization(o) for o in list_fn(namespace).items]
        except Exception as e:
            logger.error(f"Failed to list {resource_type}: {e}")
            return []

    def _fetch_cluster(self, resource_type: str, list_fn):
        if self._cache:
            return self._cache.get(resource_type, None)
        try:
            from kubernetes.client import ApiClient
            api = ApiClient()
            return [api.sanitize_for_serialization(o) for o in list_fn().items]
        except Exception as e:
            logger.error(f"Failed to list {resource_type}: {e}")
            return []

    def get_events(self, namespace: str | None, event_type: str | None, search: str | None, limit: int = 200) -> EventsListResponse:
        all_events = self._fetch('events', namespace, self._k8s.list_events)
        warning_count = sum(1 for e in all_events if e.get("type", "Normal") == "Warning")
        
        filtered = all_events
        if event_type:
            filtered = [e for e in filtered if e.get("type", "Normal") == event_type]
            
        if search:
            search_lower = search.lower()
            def matches(e) -> bool:
                r = e.get("reason", "") or ""
                m = e.get("message", "") or ""
                n = e.get("involvedObject", {}).get("name", "") or ""
                return search_lower in r.lower() or search_lower in m.lower() or search_lower in n.lower()
            filtered = [e for e in filtered if matches(e)]

        def get_ts(e):
            return e.get("lastTimestamp") or e.get("firstTimestamp") or e.get("metadata", {}).get("creationTimestamp") or ""

        filtered.sort(key=lambda e: get_ts(e), reverse=True)
        filtered = filtered[:limit]

        items = []
        for e in filtered:
            io = e.get("involvedObject", {})
            src = e.get("source", {})
            meta = e.get("metadata", {})
            
            items.append(EventItem(
                uid=meta.get("uid", ""),
                type=e.get("type", "Normal") or "Normal",
                reason=e.get("reason", "") or "",
                message=e.get("message", "") or "",
                count=e.get("count", 1) or 1,
                first_time=e.get("firstTimestamp"),
                last_time=e.get("lastTimestamp"),
                regarding=f"{io.get('kind', '')}/{io.get('name', '')}",
                regarding_namespace=io.get("namespace"),
                source_component=src.get("component") if src else None,
                namespace=meta.get("namespace"),
            ))
            
        return EventsListResponse(
            events=items,
            warning_count=warning_count,
            total=len(all_events)
        )

    def get_roles(self, namespace: str | None) -> RoleListResponse:
        items = []
        
        if namespace:
            roles = self._fetch('roles', namespace, self._k8s.list_roles)
            for r in roles:
                items.append(self._map_role(r))
        else:
            roles = self._fetch('roles', None, self._k8s.list_roles)
            for r in roles:
                items.append(self._map_role(r))
            
            cluster_roles = self._fetch_cluster('clusterroles', self._k8s.list_cluster_roles)
            for cr in cluster_roles:
                items.append(self._map_role(cr))
                
        return RoleListResponse(items=items)

    def get_cluster_roles(self) -> RoleListResponse:
        items = []
        cluster_roles = self._fetch_cluster('clusterroles', self._k8s.list_cluster_roles)
        for cr in cluster_roles:
            items.append(self._map_role(cr))
        return RoleListResponse(items=items)

    def _map_role(self, r) -> RoleItem:
        rules = []
        for rule in r.get("rules", []) or []:
            rules.append(PolicyRule(
                verbs=rule.get("verbs", []) or [],
                api_groups=rule.get("apiGroups", []) or [],
                resources=rule.get("resources", []) or [],
                resource_names=rule.get("resourceNames", []) or []
            ))
        meta = r.get("metadata", {})
        return RoleItem(
            name=meta.get("name"),
            namespace=meta.get("namespace"),
            rules=rules,
            created_at=meta.get("creationTimestamp"),
            rule_count=len(rules)
        )

    def get_role_bindings(self, namespace: str | None) -> RoleBindingListResponse:
        items = []
        bindings = self._fetch('rolebindings', namespace, self._k8s.list_role_bindings)
        for b in bindings:
            items.append(self._map_role_binding(b))
        return RoleBindingListResponse(items=items)

    def get_cluster_role_bindings(self) -> RoleBindingListResponse:
        items = []
        bindings = self._fetch_cluster('clusterrolebindings', self._k8s.list_cluster_role_bindings)
        for b in bindings:
            items.append(self._map_role_binding(b))
        return RoleBindingListResponse(items=items)

    def _map_role_binding(self, b) -> RoleBindingItem:
        subs = []
        for s in b.get("subjects", []) or []:
            subs.append(Subject(
                kind=s.get("kind", ""),
                name=s.get("name", ""),
                namespace=s.get("namespace")
            ))
        role_ref = b.get("roleRef", {}) or {}
        meta = b.get("metadata", {})
        return RoleBindingItem(
            name=meta.get("name"),
            namespace=meta.get("namespace"),
            role_ref=role_ref.get("name", ""),
            role_kind=role_ref.get("kind", ""),
            subjects=subs,
            created_at=meta.get("creationTimestamp")
        )

    def get_service_accounts(self, namespace: str | None) -> ServiceAccountListResponse:
        sas = self._fetch('serviceaccounts', namespace, self._k8s.list_service_accounts)
        
        rbs = self._fetch('rolebindings', None, self._k8s.list_role_bindings)
        crbs = self._fetch_cluster('clusterrolebindings', self._k8s.list_cluster_role_bindings)
        all_bindings = rbs + crbs
        
        items = []
        for sa in sas:
            meta = sa.get("metadata", {})
            sa_name = meta.get("name")
            sa_ns = meta.get("namespace")
            
            bound_roles = []
            for b in all_bindings:
                subjects = b.get("subjects", []) or []
                for s in subjects:
                    if s.get("kind") == "ServiceAccount" and s.get("name") == sa_name and s.get("namespace") == sa_ns:
                        role_ref = b.get("roleRef", {}) or {}
                        if role_ref.get("name"):
                            bound_roles.append(role_ref.get("name"))
            
            secrets = []
            for sec in sa.get("secrets", []) or []:
                if sec.get("name"):
                    secrets.append(sec.get("name"))

            items.append(ServiceAccountItem(
                name=sa_name,
                namespace=sa_ns,
                secrets=secrets,
                created_at=meta.get("creationTimestamp"),
                bound_roles=list(set(bound_roles))
            ))
            
        return ServiceAccountListResponse(items=items)

    def get_config_maps(self, namespace: str | None) -> ConfigMapListResponse:
        cms = self._fetch('configmaps', namespace, self._k8s.list_config_maps)
        items = []
        for cm in cms:
            meta = cm.get("metadata", {})
            name = meta.get("name", "")
            if name.startswith("kube-") or name == "coredns":
                continue
            data = cm.get("data", {}) or {}
            items.append(ConfigMapItem(
                name=name,
                namespace=meta.get("namespace"),
                keys=list(data.keys()),
                data=data,
                created_at=meta.get("creationTimestamp")
            ))
        return ConfigMapListResponse(items=items)

    def get_secrets(self, namespace: str | None) -> SecretListResponse:
        secs = self._fetch('secrets', namespace, self._k8s.list_secrets)
        items = []
        for sec in secs:
            meta = sec.get("metadata", {})
            name = meta.get("name", "")
            sec_type = sec.get("type", "Opaque") or "Opaque"
            
            if sec_type == "kubernetes.io/service-account-token":
                continue

            data = sec.get("data", {}) or {}
            items.append(SecretItem(
                name=name,
                namespace=meta.get("namespace"),
                secret_type=sec_type,
                keys=list(data.keys()),
                created_at=meta.get("creationTimestamp")
            ))
        return SecretListResponse(items=items)
