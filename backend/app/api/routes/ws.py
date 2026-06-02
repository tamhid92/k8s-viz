import logging

from flask import Blueprint, current_app, request
from flask_socketio import emit

from app.models.graph import GraphDelta, WatchEventType

ws_bp = Blueprint("ws", __name__)

logger = logging.getLogger(__name__)


@ws_bp.record_once
def _register_socketio_handlers(state):
    from app.main import socketio

    @socketio.on("connect")
    def on_connect():
        logger.info("Client connected: %s", request.sid)
        with current_app.app_context():
            gb = current_app.extensions["graph_builder"]
            delta = GraphDelta(event=WatchEventType.FULL_SYNC, graph=gb.graph)
            emit("graph_delta", delta.model_dump(mode="json"), to=request.sid)

    @socketio.on("disconnect")
    def on_disconnect():
        logger.info("Client disconnected: %s", request.sid)

    @socketio.on("ping")
    def on_ping():
        emit("pong")
