# Stage 0, "build-stage", based on Node.js, to build and compile Angular
FROM node:16.17 as build-stage

WORKDIR /app
COPY package*.json /app/
RUN npm install
COPY ./ /app/

ARG API_URL \ 
    DEMO_URL \ 
    EVALUATION_URL
RUN sed -i "s|__API_URL__|${API_URL}|g" src/environments/environment.ts  \
    && sed -i "s|__API_URL__|${API_URL}|g" src/environments/environment.prod.ts \
    && sed -i "s|__DEMO_URL__|${DEMO_URL}|g" src/environments/environment.ts  \
    && sed -i "s|__DEMO_URL__|${DEMO_URL}|g" src/environments/environment.prod.ts \
    && sed -i "s|__EVALUATION_URL__|${EVALUATION_URL}|g" src/environments/environment.ts  \
    && sed -i "s|__EVALUATION_URL__|${EVALUATION_URL}|g" src/environments/environment.prod.ts \
    && npm run build:prod

# Stage 1, based on Nginx, to have only the compiled app, ready for production with Nginx
FROM nginx:1.23
COPY --from=build-stage /app/dist/featbit/ /usr/share/nginx/featbit/

COPY ./nginx.conf /etc/nginx/conf.d/default.conf
