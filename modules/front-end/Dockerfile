# Stage 0, "build-stage", based on Node.js, to build and compile Angular
FROM node:22.19 AS build-stage

WORKDIR /app
COPY package*.json /app/
RUN npm install
COPY ./ /app/

RUN npm run build:prod

# Stage 1, based on Nginx, to have only the compiled app, ready for production with Nginx
FROM nginx:1.23

ENV API_URL \
    DEMO_URL \
    EVALUATION_URL \
    BASE_HREF \
    FEATBIT_DISPLAY_API_URL \
    FEATBIT_DISPLAY_EVAL_URL

RUN apt-get update -y && apt-get install --no-install-recommends -y gettext-base && rm -rf /var/lib/apt/lists/*

COPY --from=build-stage /app/dist/featbit/browser/ /usr/share/nginx/featbit/
COPY ./nginx.conf.template /etc/nginx/conf.d/nginx.conf.template
COPY ./nginx.base_href.conf.template /etc/nginx/conf.d/nginx.base_href.conf.template

COPY docker-entrypoint.sh /scripts/
WORKDIR /scripts
RUN chmod +x docker-entrypoint.sh
ENTRYPOINT ["./docker-entrypoint.sh"]
