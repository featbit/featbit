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
    BASE_HREF

RUN apt-get update -y && apt-get install gettext-base

COPY --from=build-stage /app/dist/featbit/browser/ /usr/share/nginx/featbit/
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.sh /scripts/
WORKDIR /scripts
RUN chmod +x docker-entrypoint.sh
ENTRYPOINT ["./docker-entrypoint.sh"]
