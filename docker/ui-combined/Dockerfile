FROM node:22.19 AS frontend-build
WORKDIR /source/modules/front-end

COPY modules/front-end/package*.json ./
RUN npm install
COPY modules/front-end/ ./
RUN npm run build:prod

FROM node:24-alpine AS release-decision-deps
WORKDIR /source/modules/release-decision-web

COPY modules/release-decision-web/package.json modules/release-decision-web/package-lock.json ./
RUN npm ci

FROM node:24-alpine AS release-decision-build
ARG VITE_FEATBIT_APP_URL=http://localhost:8081
ARG VITE_FEATBIT_API_URL=http://localhost:5000
ARG VITE_BASE_PATH=/release-decision/
ENV VITE_FEATBIT_APP_URL=$VITE_FEATBIT_APP_URL \
    VITE_FEATBIT_API_URL=$VITE_FEATBIT_API_URL \
    VITE_BASE_PATH=$VITE_BASE_PATH

WORKDIR /source/modules/release-decision-web
COPY --from=release-decision-deps /source/modules/release-decision-web/node_modules ./node_modules
COPY modules/release-decision-web/ ./
RUN npm run build

FROM nginx:1.23

ENV API_URL \
    DEMO_URL \
    EVALUATION_URL \
    BASE_HREF \
    DISPLAY_API_URL \
    DISPLAY_EVALUATION_URL \
    HOSTING_MODE \
    EXPERIMENT_PAGE_MODE

RUN apt-get update -y \
    && apt-get install --no-install-recommends -y gettext-base \
    && rm -rf /var/lib/apt/lists/*

COPY --from=frontend-build /source/modules/front-end/dist/featbit/browser/ /usr/share/nginx/featbit/
COPY --from=release-decision-build /source/modules/release-decision-web/dist/ /usr/share/nginx/release-decision/
COPY docker/ui-combined/nginx.conf.template /etc/nginx/conf.d/nginx.conf.template
COPY docker/ui-combined/nginx.base_href.conf.template /etc/nginx/conf.d/nginx.base_href.conf.template
COPY modules/front-end/docker-entrypoint.sh /scripts/

WORKDIR /scripts
RUN chmod +x docker-entrypoint.sh

EXPOSE 80
ENTRYPOINT ["./docker-entrypoint.sh"]
