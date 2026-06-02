from flask import Blueprint, jsonify, request, current_app
from app.core.resource_builder import ResourceBuilder

resources_bp = Blueprint("resources", __name__)

@resources_bp.route("/namespaces", methods=["GET"])
def get_namespaces():
    try:
        k8s = current_app.extensions["k8s_client"]
        resp = k8s.list_namespaces()
        namespaces = sorted([ns.metadata.name for ns in resp.items])
        return jsonify({"namespaces": namespaces})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@resources_bp.route("/events", methods=["GET"])
def get_events():
    try:
        namespace = request.args.get("namespace")
        event_type = request.args.get("type")
        search = request.args.get("search")
        limit_str = request.args.get("limit", "200")
        limit = int(limit_str) if limit_str.isdigit() else 200

        rb = ResourceBuilder(current_app.extensions["k8s_client"])
        resp = rb.get_events(namespace, event_type, search, limit)
        return jsonify(resp.model_dump(mode="json"))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@resources_bp.route("/rbac/roles", methods=["GET"])
def get_roles():
    try:
        namespace = request.args.get("namespace")
        scope = request.args.get("scope", "all")

        rb = ResourceBuilder(current_app.extensions["k8s_client"])
        if scope == "cluster":
            resp = rb.get_cluster_roles()
        elif scope == "namespaced":
            resp = rb.get_roles(namespace)
        else:
            resp = rb.get_roles(namespace)
        return jsonify(resp.model_dump(mode="json"))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@resources_bp.route("/rbac/bindings", methods=["GET"])
def get_bindings():
    try:
        namespace = request.args.get("namespace")
        scope = request.args.get("scope", "all")

        rb = ResourceBuilder(current_app.extensions["k8s_client"])
        if scope == "cluster":
            resp = rb.get_cluster_role_bindings()
        elif scope == "namespaced":
            resp = rb.get_role_bindings(namespace)
        else:
            ns_resp = rb.get_role_bindings(namespace)
            cl_resp = rb.get_cluster_role_bindings()
            resp = ns_resp
            resp.items.extend(cl_resp.items)
        return jsonify(resp.model_dump(mode="json"))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@resources_bp.route("/rbac/serviceaccounts", methods=["GET"])
def get_serviceaccounts():
    try:
        namespace = request.args.get("namespace")
        rb = ResourceBuilder(current_app.extensions["k8s_client"])
        resp = rb.get_service_accounts(namespace)
        return jsonify(resp.model_dump(mode="json"))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@resources_bp.route("/config/configmaps", methods=["GET"])
def get_configmaps():
    try:
        namespace = request.args.get("namespace")
        rb = ResourceBuilder(current_app.extensions["k8s_client"])
        resp = rb.get_config_maps(namespace)
        return jsonify(resp.model_dump(mode="json"))
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@resources_bp.route("/config/secrets", methods=["GET"])
def get_secrets():
    try:
        namespace = request.args.get("namespace")
        rb = ResourceBuilder(current_app.extensions["k8s_client"])
        resp = rb.get_secrets(namespace)
        return jsonify(resp.model_dump(mode="json"))
    except Exception as e:
        return jsonify({"error": str(e)}), 500
