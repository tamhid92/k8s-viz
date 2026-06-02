import logging

import kubernetes.client
import kubernetes.config

logger = logging.getLogger(__name__)


class _ItemList:
    def __init__(self, items):
        self.items = items


class K8sClient:
    def __init__(self):
        self.in_cluster = False
        self.core = None
        self.networking = None
        self.discovery = None
        self.version_api = None
        self.apps = None
        self.rbac = None
        self.batch = None

    def initialize(self):
        try:
            kubernetes.config.load_incluster_config()
            self.in_cluster = True
        except kubernetes.config.ConfigException:
            kubernetes.config.load_kube_config()
            self.in_cluster = False

        self.core = kubernetes.client.CoreV1Api()
        self.networking = kubernetes.client.NetworkingV1Api()
        self.discovery = kubernetes.client.DiscoveryV1Api()
        self.version_api = kubernetes.client.VersionApi()
        self.apps = kubernetes.client.AppsV1Api()
        self.rbac = kubernetes.client.RbacAuthorizationV1Api()
        self.batch = kubernetes.client.BatchV1Api()

    def close(self):
        try:
            kubernetes.client.ApiClient().close()
        except Exception:
            pass

    def _paginate(self, list_func, **kwargs):
        items = []
        _continue = None
        while True:
            if _continue:
                resp = list_func(limit=500, _continue=_continue, **kwargs)
            else:
                resp = list_func(limit=500, **kwargs)
            items.extend(resp.items)
            _continue = resp.metadata._continue if resp.metadata else None
            if not _continue:
                break
        return _ItemList(items)

    def list_namespaces(self):
        return self._paginate(self.core.list_namespace)

    def list_nodes(self):
        return self._paginate(self.core.list_node)

    def list_pods(self, namespace=None):
        if namespace:
            return self._paginate(self.core.list_namespaced_pod, namespace=namespace)
        return self._paginate(self.core.list_pod_for_all_namespaces)

    def list_services(self, namespace=None):
        if namespace:
            return self._paginate(self.core.list_namespaced_service, namespace=namespace)
        return self._paginate(self.core.list_service_for_all_namespaces)

    def list_ingresses(self, namespace=None):
        if namespace:
            return self._paginate(self.networking.list_namespaced_ingress, namespace=namespace)
        return self._paginate(self.networking.list_ingress_for_all_namespaces)

    def list_network_policies(self, namespace=None):
        if namespace:
            return self._paginate(self.networking.list_namespaced_network_policy, namespace=namespace)
        return self._paginate(self.networking.list_network_policy_for_all_namespaces)

    def get_server_version(self):
        try:
            return self.version_api.get_code().git_version
        except Exception:
            return None

    def read_namespaced_config_map(self, name: str, namespace: str):
        return self.core.read_namespaced_config_map(name=name, namespace=namespace)

    def list_deployments(self, namespace: str | None = None):
        if namespace:
            return self._paginate(self.apps.list_namespaced_deployment, namespace=namespace)
        return self._paginate(self.apps.list_deployment_for_all_namespaces)

    def list_statefulsets(self, namespace: str | None = None):
        if namespace:
            return self._paginate(self.apps.list_namespaced_stateful_set, namespace=namespace)
        return self._paginate(self.apps.list_stateful_set_for_all_namespaces)

    def list_daemonsets(self, namespace: str | None = None):
        if namespace:
            return self._paginate(self.apps.list_namespaced_daemon_set, namespace=namespace)
        return self._paginate(self.apps.list_daemon_set_for_all_namespaces)

    def list_events(self, namespace: str | None = None):
        if namespace:
            return self._paginate(self.core.list_namespaced_event, namespace=namespace)
        return self._paginate(self.core.list_event_for_all_namespaces)

    def list_config_maps(self, namespace: str | None = None):
        if namespace:
            return self._paginate(self.core.list_namespaced_config_map, namespace=namespace)
        return self._paginate(self.core.list_config_map_for_all_namespaces)

    def list_secrets(self, namespace: str | None = None):
        if namespace:
            return self._paginate(self.core.list_namespaced_secret, namespace=namespace)
        return self._paginate(self.core.list_secret_for_all_namespaces)

    def list_service_accounts(self, namespace: str | None = None):
        if namespace:
            return self._paginate(self.core.list_namespaced_service_account, namespace=namespace)
        return self._paginate(self.core.list_service_account_for_all_namespaces)

    def list_roles(self, namespace: str | None = None):
        if namespace:
            return self._paginate(self.rbac.list_namespaced_role, namespace=namespace)
        return self._paginate(self.rbac.list_role_for_all_namespaces)

    def list_cluster_roles(self):
        return self._paginate(self.rbac.list_cluster_role)

    def list_role_bindings(self, namespace: str | None = None):
        if namespace:
            return self._paginate(self.rbac.list_namespaced_role_binding, namespace=namespace)
        return self._paginate(self.rbac.list_role_binding_for_all_namespaces)

    def list_cluster_role_bindings(self):
        return self._paginate(self.rbac.list_cluster_role_binding)

    def list_jobs(self, namespace: str | None = None):
        if namespace:
            return self._paginate(self.batch.list_namespaced_job, namespace=namespace)
        return self._paginate(self.batch.list_job_for_all_namespaces)

    def list_cron_jobs(self, namespace: str | None = None):
        if namespace:
            return self._paginate(self.batch.list_namespaced_cron_job, namespace=namespace)
        return self._paginate(self.batch.list_cron_job_for_all_namespaces)

