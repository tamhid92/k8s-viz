from flask import Blueprint, request, jsonify, current_app, Response, stream_with_context
import time

logs_bp = Blueprint("logs", __name__)

@logs_bp.get("/logs/deployments")
def list_deployments_for_logs():
    namespace = request.args.get("namespace") or None
    gb = current_app.extensions["graph_builder"]
    k8s = current_app.extensions["k8s_client"]
    try:
        deps = k8s.list_deployments(namespace).items
        return jsonify({
            "deployments": [
                {
                    "name": d.metadata.name,
                    "namespace": d.metadata.namespace,
                    "ready": f"{d.status.ready_replicas or 0}/{d.spec.replicas or 0}",
                    "health": (
                        "healthy" if (d.status.ready_replicas or 0) == (d.spec.replicas or 1)
                        else "unavailable" if (d.status.ready_replicas or 0) == 0
                        else "degraded"
                    ),
                }
                for d in sorted(deps, key=lambda d: (d.metadata.namespace, d.metadata.name))
            ]
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@logs_bp.get("/logs/pods")
def list_pods_for_logs():
    namespace = request.args.get("namespace") or None
    k8s = current_app.extensions["k8s_client"]
    try:
        pods_list = k8s.list_pods(namespace).items
        return jsonify({
            "pods": [
                {
                    "name": p.metadata.name,
                    "namespace": p.metadata.namespace,
                    "phase": p.status.phase,
                    "node_name": p.spec.node_name or "Unknown",
                    "id": p.metadata.uid,
                    "labels": p.metadata.labels or {}
                }
                for p in sorted(pods_list, key=lambda p: (p.metadata.namespace, p.metadata.name))
            ]
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@logs_bp.get("/logs/pod/<namespace>/<pod_name>")
def get_pod_logs(namespace, pod_name):
    tail = request.args.get("tail", "100")
    k8s = current_app.extensions["k8s_client"]
    try:
        logs = k8s.core.read_namespaced_pod_log(
            name=pod_name, 
            namespace=namespace, 
            tail_lines=int(tail), 
            timestamps=True
        )
        return jsonify({"logs": logs})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@logs_bp.get("/logs/pod/<namespace>/<pod_name>/stream")
def stream_pod_logs(namespace, pod_name):
    tail = request.args.get("tail", "100")
    k8s = current_app.extensions["k8s_client"]
    
    def generate():
        try:
            w = k8s.core.read_namespaced_pod_log(
                name=pod_name, 
                namespace=namespace, 
                tail_lines=int(tail), 
                follow=True,
                timestamps=True,
                _preload_content=False
            )
            for line in w.stream():
                yield f"data: {line.decode('utf-8')}\n\n"
        except Exception as e:
            yield f"data: ERROR: {str(e)}\n\n"
            
    return Response(stream_with_context(generate()), mimetype="text/event-stream")


@logs_bp.get("/logs/deployment/<namespace>/<name>")
def get_deployment_logs(namespace, name):
    tail = request.args.get("tail", "50")
    k8s = current_app.extensions["k8s_client"]
    try:
        # Find pods for this deployment
        pods_list = k8s.list_pods(namespace).items
        
        # A simple matching heuristic (deployment name is prefix of pod name)
        # Ideally we'd use label selectors, but prefix is often good enough for logs
        dep_pods = [p for p in pods_list if p.metadata.name.startswith(name + "-")]
        
        all_logs = []
        for p in dep_pods:
            try:
                logs = k8s.core.read_namespaced_pod_log(
                    name=p.metadata.name, 
                    namespace=namespace, 
                    tail_lines=int(tail), 
                    timestamps=True
                )
                for line in logs.splitlines():
                    parts = line.split(" ", 1)
                    if len(parts) == 2:
                        ts = parts[0]
                        all_logs.append((ts, p.metadata.name, line))
                    else:
                        all_logs.append(("", p.metadata.name, line))
            except:
                pass
                
        # Sort logs by timestamp
        all_logs.sort(key=lambda x: x[0])
        
        result_lines = [{"pod": item[1], "line": item[2]} for item in all_logs]
        
        return jsonify({"lines": result_lines})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
