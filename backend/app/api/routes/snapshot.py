from datetime import datetime, timezone

from flask import Blueprint, current_app, jsonify, request
from pydantic import ValidationError

from app.models.graph import GraphDelta, Snapshot, WatchEventType

snapshot_bp = Blueprint("snapshot", __name__)


def _get_gb():
    return current_app.extensions["graph_builder"]


@snapshot_bp.get("/snapshot")
def export_snapshot():
    gb = _get_gb()
    snapshot = Snapshot(
        cluster_info=gb.graph.cluster_info,
        graph=gb.graph,
    )
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    filename = f"k8s-viz-snapshot-{timestamp}.json"
    response = current_app.response_class(
        response=snapshot.model_dump_json(),
        status=200,
        mimetype="application/json",
    )
    response.headers["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


@snapshot_bp.post("/snapshot")
def import_snapshot():
    from app.main import socketio

    try:
        snapshot = Snapshot.model_validate(request.get_json())
    except ValidationError as exc:
        return jsonify({"error": str(exc)}), 400

    gb = _get_gb()
    with gb._lock:
        gb.graph.clear()
        for node in snapshot.graph.nodes:
            gb.graph.upsert_node(node)
        for edge in snapshot.graph.edges:
            gb.graph.upsert_edge(edge)
        gb.graph.cluster_info = snapshot.cluster_info

    delta = GraphDelta(event=WatchEventType.FULL_SYNC, graph=gb.graph)
    socketio.emit("graph_delta", delta.model_dump(mode="json"))

    return jsonify({
        "status": "imported",
        "nodes": len(snapshot.graph.nodes),
        "edges": len(snapshot.graph.edges),
    })
