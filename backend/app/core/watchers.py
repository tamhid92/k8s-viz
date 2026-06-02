import logging
import threading

import kubernetes.watch

logger = logging.getLogger(__name__)


class ResourceWatcher:
    def __init__(self, k8s_client, graph_builder, socketio):
        self._k8s_client = k8s_client
        self._graph_builder = graph_builder
        self._socketio = socketio
        self._stop_event = threading.Event()
        self._threads = []

    def _watch_loop(self, list_func, resource_type, thread_name):
        import kubernetes.client.exceptions
        backoff = 1
        while not self._stop_event.is_set():
            try:
                w = kubernetes.watch.Watch()
                for event in w.stream(list_func, timeout_seconds=60):
                    if self._stop_event.is_set():
                        w.stop()
                        return
                    delta = self._graph_builder.handle_event(
                        resource_type, event["type"], event["object"]
                    )
                    self._socketio.emit(
                        "graph_delta",
                        delta.model_dump(mode="json")
                    )
                    backoff = 1
            except kubernetes.client.exceptions.ApiException as e:
                if e.status == 410:
                    self._graph_builder.full_sync()
                else:
                    self._stop_event.wait(backoff)
                    backoff = min(backoff * 2, 30)
            except Exception as e:
                self._stop_event.wait(backoff)
                backoff = min(backoff * 2, 30)

    def start(self):
        watch_targets = [
            (self._k8s_client.core.list_pod_for_all_namespaces, "pod", "watch-pods"),
            (self._k8s_client.core.list_service_for_all_namespaces, "service", "watch-services"),
            (self._k8s_client.core.list_node, "node", "watch-nodes"),
            (self._k8s_client.core.list_namespace, "namespace", "watch-namespaces"),
            (self._k8s_client.networking.list_ingress_for_all_namespaces, "ingress", "watch-ingresses"),
            (self._k8s_client.networking.list_network_policy_for_all_namespaces, "network_policy", "watch-netpols"),
        ]

        for list_func, resource_type, thread_name in watch_targets:
            t = threading.Thread(
                target=self._watch_loop,
                args=(list_func, resource_type, thread_name),
                name=thread_name,
                daemon=True,
            )
            t.start()
            self._threads.append(t)

    def stop(self):
        self._stop_event.set()
        for t in self._threads:
            t.join(timeout=5)
