import threading
import logging
from kubernetes.client import ApiClient

logger = logging.getLogger(__name__)

class ResourceCache:
    def __init__(self, k8s_client):
        self._k8s = k8s_client
        self._state: dict[str, list] = {}
        self._lock = threading.RLock()
        self._stop_event = threading.Event()
        self.is_ready: bool = False
        self._threads: list[threading.Thread] = []

    def initialize(self):
        logger.info("Initializing ResourceCache...")
        api_client = ApiClient()
        resources = [
            ("pods", self._k8s.core.list_pod_for_all_namespaces),
            ("services", self._k8s.core.list_service_for_all_namespaces),
            ("namespaces", self._k8s.core.list_namespace),
            ("nodes", self._k8s.core.list_node),
            ("ingresses", self._k8s.networking.list_ingress_for_all_namespaces),
            ("networkpolicies", self._k8s.networking.list_network_policy_for_all_namespaces),
            ("deployments", self._k8s.apps.list_deployment_for_all_namespaces),
            ("statefulsets", self._k8s.apps.list_stateful_set_for_all_namespaces),
            ("daemonsets", self._k8s.apps.list_daemon_set_for_all_namespaces),
            ("jobs", self._k8s.batch.list_job_for_all_namespaces),
            ("cronjobs", self._k8s.batch.list_cron_job_for_all_namespaces),
            ("configmaps", self._k8s.core.list_config_map_for_all_namespaces),
            ("secrets", self._k8s.core.list_secret_for_all_namespaces),
            ("serviceaccounts", self._k8s.core.list_service_account_for_all_namespaces),
            ("roles", self._k8s.rbac.list_role_for_all_namespaces),
            ("clusterroles", self._k8s.rbac.list_cluster_role),
            ("rolebindings", self._k8s.rbac.list_role_binding_for_all_namespaces),
            ("clusterrolebindings", self._k8s.rbac.list_cluster_role_binding),
            ("events", self._k8s.core.list_event_for_all_namespaces),
        ]

        for resource_type, list_fn in resources:
            try:
                response = list_fn()
                items = [api_client.sanitize_for_serialization(obj) for obj in response.items]
                self._state[resource_type] = items
            except Exception as e:
                logger.warning(f"Failed to initialize cache for {resource_type}: {e}")
                self._state[resource_type] = []

        self.is_ready = True
        logger.info("ResourceCache initialized.")

    def start(self):
        resources = [
            ("pods", self._k8s.core.list_pod_for_all_namespaces),
            ("services", self._k8s.core.list_service_for_all_namespaces),
            ("namespaces", self._k8s.core.list_namespace),
            ("nodes", self._k8s.core.list_node),
            ("ingresses", self._k8s.networking.list_ingress_for_all_namespaces),
            ("networkpolicies", self._k8s.networking.list_network_policy_for_all_namespaces),
            ("deployments", self._k8s.apps.list_deployment_for_all_namespaces),
            ("statefulsets", self._k8s.apps.list_stateful_set_for_all_namespaces),
            ("daemonsets", self._k8s.apps.list_daemon_set_for_all_namespaces),
            ("jobs", self._k8s.batch.list_job_for_all_namespaces),
            ("cronjobs", self._k8s.batch.list_cron_job_for_all_namespaces),
            ("configmaps", self._k8s.core.list_config_map_for_all_namespaces),
            ("secrets", self._k8s.core.list_secret_for_all_namespaces),
            ("serviceaccounts", self._k8s.core.list_service_account_for_all_namespaces),
            ("roles", self._k8s.rbac.list_role_for_all_namespaces),
            ("clusterroles", self._k8s.rbac.list_cluster_role),
            ("rolebindings", self._k8s.rbac.list_role_binding_for_all_namespaces),
            ("clusterrolebindings", self._k8s.rbac.list_cluster_role_binding),
            ("events", self._k8s.core.list_event_for_all_namespaces),
        ]

        for resource_type, list_fn in resources:
            t = threading.Thread(
                target=self._watch_loop,
                args=(resource_type, list_fn),
                name=f"cache-watch-{resource_type}",
                daemon=True
            )
            t.start()
            self._threads.append(t)

    def stop(self):
        self._stop_event.set()
        for t in self._threads:
            t.join(timeout=5)

    def _watch_loop(self, resource_type: str, list_fn):
        from kubernetes import watch as k8s_watch
        from kubernetes.client import ApiClient, exceptions

        api_client = ApiClient()
        backoff = 1

        while not self._stop_event.is_set():
            w = k8s_watch.Watch()
            try:
                for event in w.stream(list_fn, timeout_seconds=300):
                    if self._stop_event.is_set():
                        w.stop()
                        return

                    event_type = event['type']
                    obj        = event['object']
                    serialized = api_client.sanitize_for_serialization(obj)
                    name       = obj.metadata.name
                    namespace  = getattr(obj.metadata, 'namespace', None)

                    with self._lock:
                        items = self._state.get(resource_type, [])
                        if event_type == 'DELETED':
                            self._state[resource_type] = [
                                o for o in items
                                if not (o.get('metadata', {}).get('name') == name
                                        and o.get('metadata', {}).get('namespace') == namespace)
                            ]
                        else:
                            idx = next(
                                (i for i, o in enumerate(items)
                                 if o.get('metadata', {}).get('name') == name
                                 and o.get('metadata', {}).get('namespace') == namespace),
                                None
                            )
                            if idx is not None:
                                self._state[resource_type][idx] = serialized
                            else:
                                self._state[resource_type].append(serialized)

                    backoff = 1

            except exceptions.ApiException as e:
                if e.status == 410:
                    self._relist(resource_type, list_fn, api_client)
                else:
                    logging.getLogger(__name__).warning(
                        "Watch error on %s: %s. Retrying in %ds.", resource_type, e, backoff
                    )
                    self._stop_event.wait(backoff)
                    backoff = min(backoff * 2, 30)

            except Exception as e:
                logging.getLogger(__name__).warning(
                    "Watch error on %s: %s. Retrying in %ds.", resource_type, e, backoff
                )
                self._stop_event.wait(backoff)
                backoff = min(backoff * 2, 30)

    def _relist(self, resource_type: str, list_fn, api_client):
        try:
            response = list_fn()
            items = [api_client.sanitize_for_serialization(obj)
                     for obj in response.items]
            with self._lock:
                self._state[resource_type] = items
        except Exception as e:
            logging.getLogger(__name__).error(
                "Relist failed for %s: %s", resource_type, e
            )

    def get(self, resource_type: str, namespace: str | None = None) -> list:
        with self._lock:
            items = list(self._state.get(resource_type, []))
        if namespace:
            items = [
                item for item in items
                if item.get('metadata', {}).get('namespace') == namespace
            ]
        return items
