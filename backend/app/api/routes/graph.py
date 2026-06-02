from flask import Blueprint, current_app, jsonify, request

from app.models.graph import NodeType

graph_bp = Blueprint("graph", __name__)


def _get_gb():
    return current_app.extensions["graph_builder"]


def _filter_nodes(nodes, namespace, node_type):
    if namespace:
        nodes = [n for n in nodes if n.namespace == namespace or n.namespace is None]
    if node_type:
        try:
            nt = NodeType(node_type)
            nodes = [n for n in nodes if n.type == nt]
        except ValueError:
            pass
    return nodes


def _filter_edges(edges, node_ids):
    return [e for e in edges if e.source in node_ids and e.target in node_ids]


@graph_bp.get("/graph")
def get_graph():
    gb = _get_gb()
    graph = gb.graph
    namespace = request.args.get("namespace")
    node_type = request.args.get("node_type")

    nodes = list(graph.nodes)
    nodes = _filter_nodes(nodes, namespace, node_type)
    node_ids = {n.id for n in nodes}
    edges = _filter_edges(graph.edges, node_ids)

    return jsonify({
        "nodes": [n.model_dump(mode="json") for n in nodes],
        "edges": [e.model_dump(mode="json") for e in edges],
        "generated_at": graph.generated_at.isoformat(),
        "cluster_info": graph.cluster_info.model_dump(mode="json"),
    })


@graph_bp.get("/graph/nodes")
def get_nodes():
    gb = _get_gb()
    namespace = request.args.get("namespace")
    node_type = request.args.get("node_type")

    nodes = list(gb.graph.nodes)
    nodes = _filter_nodes(nodes, namespace, node_type)
    return jsonify([n.model_dump(mode="json") for n in nodes])


@graph_bp.get("/graph/nodes/<path:node_id>")
def get_node(node_id):
    gb = _get_gb()
    node = gb.graph.get_node(node_id)
    if node is None:
        return jsonify({"error": "not found"}), 404
    return jsonify(node.model_dump(mode="json"))


@graph_bp.get("/graph/nodes/<path:node_id>/edges")
def get_node_edges(node_id):
    gb = _get_gb()
    if gb.graph.get_node(node_id) is None:
        return jsonify({"error": "not found"}), 404
    edges = gb.graph.edges_for_node(node_id)
    return jsonify([e.model_dump(mode="json") for e in edges])


@graph_bp.get("/graph/namespaces")
def get_namespaces():
    gb = _get_gb()
    namespaces = sorted({
        n.id.split("/")[1]
        for n in gb.graph.nodes
        if n.id.startswith("namespace/")
    })
    return jsonify({"namespaces": namespaces})


@graph_bp.get("/graph/summary")
def get_summary():
    gb = _get_gb()
    graph = gb.graph
    by_type = {}
    for n in graph.nodes:
        key = n.type.value
        by_type[key] = by_type.get(key, 0) + 1
    return jsonify({
        "is_ready": gb.is_ready,
        "cluster_info": graph.cluster_info.model_dump(mode="json"),
        "counts": {
            "nodes": len(graph.nodes),
            "edges": len(graph.edges),
            "by_type": by_type,
        },
    })
