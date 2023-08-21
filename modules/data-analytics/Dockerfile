FROM python:3.9-slim-buster
ARG KAFKA_HOSTS=kafka:9092
ARG CLICKHOUSE_HOST=clickhouse-server
ARG CLICKHOUSE_KAFKA_HOSTS=kafka:9092
ARG TEST=false
ARG SUFFIX=
ARG CLICKHOUSE_USER=default
ARG CLICKHOUSE_PASSWORD=
ARG REDIS_URL=redis://redis:6379/0
ARG MONGO_HOST=mongodb
ARG MONGO_PORT=27017
ARG MONGO_URI=mongodb://admin:password@mongodb:27017
ARG MONGO_INITDB_DATABASE=featbit
ARG IS_PRO=false
ARG CHECK_DB_LIVNESS=true
ENV KAFKA_HOSTS=${KAFKA_HOSTS} \
    CLICKHOUSE_USER=${CLICKHOUSE_USER} \
    CLICKHOUSE_PASSWORD=${CLICKHOUSE_PASSWORD} \
    CLICKHOUSE_HOST=${CLICKHOUSE_HOST} \
    CLICKHOUSE_KAFKA_HOSTS=${CLICKHOUSE_KAFKA_HOSTS} \
    REDIS_URL=${REDIS_URL} \
    TEST=${TEST} \
    SUFFIX=${SUFFIX} \
    MONGO_HOST=${MONGO_HOST} \
    MONGO_PORT=${MONGO_PORT} \
    MONGO_URI=${MONGO_URI} \
    MONGO_DB=${MONGO_INITDB_DATABASE} \
    IS_PRO=${IS_PRO} \
    CHECK_DB_LIVNESS=${CHECK_DB_LIVNESS}
RUN apt update &&apt install -y nginx && apt install -y supervisor && apt install -y git
RUN mkdir -p /var/log/nginx && \
    touch /var/log/nginx/access.log && \
    touch /var/log/nginx/error.log
EXPOSE 80
COPY nginx.conf /etc/nginx/nginx.conf
COPY . /featbit_da
WORKDIR /featbit_da
RUN chmod +x start.sh docker-entrypoint.sh wait-for-it.sh
RUN pip install -r requirements.txt
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["/usr/bin/supervisord","-c","supervisord.conf"]
