FROM python:3.12-slim

WORKDIR /app

ARG BUILD_DATE
ARG VERSION
ARG REVISION

LABEL org.opencontainers.image.title="k8s-viz-backend" \
      org.opencontainers.image.description="Kubernetes network topology visualizer - backend" \
      org.opencontainers.image.authors="Tamhid Chowdhury <tamhidchowdhury@gmail.com>" \
      org.opencontainers.image.url="https://github.com/tamhid92/k8s-viz" \
      org.opencontainers.image.source="https://github.com/tamhid92/k8s-viz" \
      org.opencontainers.image.documentation="https://github.com/tamhid92/k8s-viz/blob/main/README.md" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.vendor="Tamhid Chowdhury" \
      org.opencontainers.image.created=$BUILD_DATE \
      org.opencontainers.image.version=$VERSION \
      org.opencontainers.image.revision=$REVISION


COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["gunicorn", "--worker-class", "eventlet", "-w", "1", "--bind", "0.0.0.0:5000", "app.main:app"]
