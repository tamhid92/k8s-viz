FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html

ARG BUILD_DATE
ARG VERSION
ARG REVISION

LABEL org.opencontainers.image.title="k8s-viz-frontend" \
      org.opencontainers.image.description="Kubernetes network topology visualizer - frontend" \
      org.opencontainers.image.authors="Tamhid Chowdhury <tamhidchowdhury@gmail.com>" \
      org.opencontainers.image.url="https://github.com/tamhid92/k8s-viz" \
      org.opencontainers.image.source="https://github.com/tamhid92/k8s-viz" \
      org.opencontainers.image.documentation="https://github.com/tamhid92/k8s-viz/blob/main/README.md" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.vendor="Tamhid Chowdhury" \
      org.opencontainers.image.created=$BUILD_DATE \
      org.opencontainers.image.version=$VERSION \
      org.opencontainers.image.revision=$REVISION


EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
