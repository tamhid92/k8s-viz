import atexit
import logging
import os

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO

from app.core.k8s_client import K8sClient
from app.core.graph_builder import GraphBuilder
from app.core.watchers import ResourceWatcher

from app.api.routes.graph import graph_bp
from app.api.routes.snapshot import snapshot_bp
from app.api.routes.ws import ws_bp

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger(__name__)

socketio = SocketIO()

def _init_services(app: Flask) -> None:
    k8s_client = K8sClient()
    k8s_client.initialize()
    logger.info("K8s client ready  (in_cluster=%s)", k8s_client.in_cluster)

    # 2. Graph builder – full sync --------------------------------------------
    graph_builder = GraphBuilder(k8s_client)
    graph_builder.full_sync()
    logger.info(
        "Initial graph built  nodes=%d  edges=%d",
        len(graph_builder.graph.nodes),
        len(graph_builder.graph.edges),
    )
    watcher = ResourceWatcher(k8s_client, graph_builder, socketio)
    watcher.start()
    logger.info("Resource watchers started")

    app.extensions["k8s_client"] = k8s_client
    app.extensions["graph_builder"] = graph_builder
    app.extensions["watcher"] = watcher

    from app.core.resource_cache import ResourceCache
    resource_cache = ResourceCache(k8s_client)
    resource_cache.initialize()
    resource_cache.start()
    logger.info("Resource cache initialized and watching")
    app.extensions["resource_cache"] = resource_cache

    def _on_shutdown() -> None:
        logger.info("k8s-viz shutting down ...")
        watcher.stop()
        resource_cache.stop()
        k8s_client.close()
        logger.info("Shutdown complete")

    atexit.register(_on_shutdown)


def create_app() -> Flask:
    app = Flask(__name__, static_folder=None)

    app.config.update(
        SECRET_KEY=os.getenv("SECRET_KEY", "k8s-viz-dev-secret"),
        STATIC_DIR=os.getenv("STATIC_DIR", "/app/static"),
    )
    CORS(
        app,
        origins="*",
        supports_credentials=True,
    )
    socketio.init_app(
        app,
        cors_allowed_origins="*",
        async_mode="threading",
        logger=False,
        engineio_logger=False,
    )

    from app.api.routes.trace import trace_bp
    from app.api.routes.workloads import workloads_bp
    from app.api.routes.resources import resources_bp
    from app.api.routes.describe import describe_bp
    from app.api.routes.logs import logs_bp
    
    app.register_blueprint(graph_bp,    url_prefix="/api/v1")
    app.register_blueprint(snapshot_bp, url_prefix="/api/v1")
    app.register_blueprint(trace_bp,    url_prefix="/api/v1")
    app.register_blueprint(workloads_bp, url_prefix="/api/v1/workloads")
    app.register_blueprint(resources_bp, url_prefix="/api/v1")
    app.register_blueprint(describe_bp, url_prefix="/api/v1")
    app.register_blueprint(logs_bp, url_prefix="/api/v1")
    app.register_blueprint(ws_bp)

    @app.get("/healthz")
    def healthz():
        return jsonify({"status": "ok"})

    @app.get("/readyz")
    def readyz():
        gb = app.extensions.get("graph_builder")
        rc = app.extensions.get("resource_cache")
        if gb and gb.is_ready and rc and rc.is_ready:
            return jsonify({
                "status": "ready",
                "nodes": len(gb.graph.nodes),
                "edges": len(gb.graph.edges),
            })
        return jsonify({"status": "not_ready"}), 503

    static_dir = app.config["STATIC_DIR"]
    if os.path.isdir(static_dir):

        @app.route("/assets/<path:filename>")
        def serve_assets(filename):
            """Serve hashed JS / CSS / image bundles."""
            return send_from_directory(os.path.join(static_dir, "assets"), filename)

        @app.route("/", defaults={"path": ""})
        @app.route("/<path:path>")
        def serve_spa(path):
            """
            Catch-all: return index.html for every non-API, non-asset path
            so React Router can handle client-side navigation.
            Flask matches /api/... and /ws/... blueprints first, so they
            never reach this handler.
            """
            return send_from_directory(static_dir, "index.html")

    _init_services(app)

    return app

app = create_app()


if __name__ == "__main__":
    socketio.run(
        app,
        host="0.0.0.0",
        port=int(os.getenv("PORT", 5000)),
        debug=os.getenv("FLASK_DEBUG", "true").lower() == "true",
        use_reloader=False,
        allow_unsafe_werkzeug=True,
    )