from flask import Blueprint, jsonify, request, current_app
from app.core.workload_builder import WorkloadBuilder
import logging

logger = logging.getLogger(__name__)

workloads_bp = Blueprint("workloads", __name__, url_prefix="/workloads")

@workloads_bp.route("/deployments", methods=["GET"])
def get_deployments():
    namespace = request.args.get("namespace")
    try:
        gb = current_app.extensions.get("graph_builder")
        builder = WorkloadBuilder(current_app.extensions["k8s_client"], gb, current_app.extensions.get("resource_cache"))
        resp = builder.get_deployments(namespace=namespace)
        return jsonify(resp.model_dump(mode="json"))
    except Exception as e:
        logger.exception("Failed to get deployments")
        return jsonify({"error": str(e)}), 500

@workloads_bp.route("/statefulsets", methods=["GET"])
def get_statefulsets():
    namespace = request.args.get("namespace")
    try:
        gb = current_app.extensions.get("graph_builder")
        builder = WorkloadBuilder(current_app.extensions["k8s_client"], gb, current_app.extensions.get("resource_cache"))
        resp = builder.get_statefulsets(namespace=namespace)
        return jsonify(resp.model_dump(mode="json"))
    except Exception as e:
        logger.exception("Failed to get statefulsets")
        return jsonify({"error": str(e)}), 500

@workloads_bp.route("/daemonsets", methods=["GET"])
def get_daemonsets():
    namespace = request.args.get("namespace")
    try:
        gb = current_app.extensions.get("graph_builder")
        builder = WorkloadBuilder(current_app.extensions["k8s_client"], gb, current_app.extensions.get("resource_cache"))
        resp = builder.get_daemonsets(namespace=namespace)
        return jsonify(resp.model_dump(mode="json"))
    except Exception as e:
        logger.exception("Failed to get daemonsets")
        return jsonify({"error": str(e)}), 500

@workloads_bp.route("/events", methods=["GET"])
def get_events():
    namespace = request.args.get("namespace")
    regarding = request.args.get("regarding")
    try:
        gb = current_app.extensions.get("graph_builder")
        builder = WorkloadBuilder(current_app.extensions["k8s_client"], gb, current_app.extensions.get("resource_cache"))
        resp = builder.get_events(namespace=namespace, regarding=regarding)
        return jsonify(resp.model_dump(mode="json"))
    except Exception as e:
        logger.exception("Failed to get events")
        return jsonify({"error": str(e)}), 500

@workloads_bp.get("/deployments/<namespace>/<name>/map")
def deployment_map(namespace: str, name: str):
    try:
        gb = current_app.extensions.get("graph_builder")
        k8s = current_app.extensions["k8s_client"]
        builder = WorkloadBuilder(k8s, gb, current_app.extensions.get("resource_cache"))
        result = builder.get_deployment_map(namespace, name)
        return jsonify(result.model_dump(mode="json"))
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        logger.exception("Failed to build deployment map")
        return jsonify({"error": str(e)}), 500

@workloads_bp.get("/namespaces/<namespace>/map")
def namespace_map(namespace: str):
    try:
        gb  = current_app.extensions.get("graph_builder")
        k8s = current_app.extensions["k8s_client"]
        builder = WorkloadBuilder(k8s, gb, current_app.extensions.get("resource_cache"))
        result  = builder.get_namespace_map(namespace)
        return jsonify(result.model_dump(mode="json"))
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        logger.error(f"Failed to build namespace map: {tb}")
        return jsonify({"error": str(e), "traceback": tb}), 500

@workloads_bp.get("/jobs")
def list_jobs():
    namespace = request.args.get("namespace") or None
    try:
        gb  = current_app.extensions.get("graph_builder")
        k8s = current_app.extensions["k8s_client"]
        result = WorkloadBuilder(k8s, gb, current_app.extensions.get("resource_cache")).get_jobs(namespace)
        return jsonify(result.model_dump(mode="json"))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@workloads_bp.get("/cronjobs")
def list_cron_jobs():
    namespace = request.args.get("namespace") or None
    try:
        gb  = current_app.extensions.get("graph_builder")
        k8s = current_app.extensions["k8s_client"]
        result = WorkloadBuilder(k8s, gb, current_app.extensions.get("resource_cache")).get_cron_jobs(namespace)
        return jsonify(result.model_dump(mode="json"))
    except Exception as e:
        return jsonify({"error": str(e)}), 500
