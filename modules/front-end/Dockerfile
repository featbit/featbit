# Stage 0, "build-stage", based on Node.js, to build and compile Angular
FROM node:16.17 as build-stage

WORKDIR /app
COPY package*.json /app/
RUN npm install
COPY ./ /app/

RUN npm run build:prod

# Stage 1, based on Nginx, to have only the compiled app, ready for production with Nginx
FROM nginx:1.23

RUN apt-get update -y && apt-get install gettext-base

COPY --from=build-stage /app/dist/featbit/ /usr/share/nginx/featbit/
COPY ./nginx.conf /etc/nginx/conf.d/default.conf

ENV API_URL \
    DEMO_URL \
    EVALUATION_URL

CMD ["/bin/sh",  "-c",  "envsubst < /usr/share/nginx/featbit/en/assets/env.template.js > /usr/share/nginx/featbit/en/assets/env.js && envsubst < /usr/share/nginx/featbit/zh/assets/env.template.js > /usr/share/nginx/featbit/zh/assets/env.js && exec nginx -g 'daemon off;'"]

