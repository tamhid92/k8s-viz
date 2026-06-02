from flask import Blueprint, jsonify, request, current_app
from app.core.tracer import PacketTracer

trace_bp = Blueprint("trace", __name__)

@trace_bp.route("/trace", methods=["GET"])
def get_trace():
    from_id = request.args.get("from")
    to_id   = request.args.get("to")
    if not from_id or not to_id:
        return jsonify({"error": "from and to are required"}), 400

    gb = current_app.extensions["graph_builder"]
    k8s = current_app.extensions["k8s_client"]

    tracer = PacketTracer(k8s, gb)
    result = tracer.trace(from_id, to_id)
    return jsonify(result.model_dump(mode="json"))
