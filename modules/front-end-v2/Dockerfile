FROM node:22.19 AS build-stage

WORKDIR /app
COPY package*.json /app/
RUN npm ci
COPY ./ /app/
RUN npm run build

FROM nginx:1.30.4

ARG VERSION=dev

ENV API_URL="" \
    DEMO_URL="" \
    EVALUATION_URL="" \
    BASE_HREF="" \
    DISPLAY_API_URL="" \
    DISPLAY_EVALUATION_URL="" \
    HOSTING_MODE="" \
    VERSION=${VERSION}

RUN apt-get update -y \
    && apt-get install --no-install-recommends -y gettext-base \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build-stage /app/dist/ /usr/share/nginx/featbit/
COPY ./nginx.conf.template /etc/nginx/conf.d/nginx.conf.template
COPY ./nginx.base_href.conf.template /etc/nginx/conf.d/nginx.base_href.conf.template
COPY ./docker-entrypoint.sh /scripts/

WORKDIR /scripts
RUN chmod +x docker-entrypoint.sh
ENTRYPOINT ["./docker-entrypoint.sh"]
