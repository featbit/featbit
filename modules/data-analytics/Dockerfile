FROM python:3.9-slim-buster
ENV TEST=false \
    KAFKA_HOSTS=kafka:9092 \
    KAFKA_SECURITY_PROTOCOL=PLAINTEXT \
    KAFKA_SASL_MECHANISM=PLAIN \
    CLICKHOUSE_USER=default \
    CLICKHOUSE_HOST=clickhouse-server \
    CLICKHOUSE_PORT=9000 \
    CLICKHOUSE_HTTP_PORT=8123 \
    CLICKHOUSE_KAFKA_HOSTS=kafka:9092 \
    CLICKHOUSE_DATABASE=featbit \
    CLICKHOUSE_CLUSTER=featbit_ch_cluster \
    CLICKHOUSE_REPLICATION=true \
    CLICKHOUSE_SECURE=false \
    CLICKHOUSE_VERIFY=true \
    CACHE_TYPE=RedisCache \
    REDIS_DB=0 \
    REDIS_SSL=false \
    REDIS_HOST=redis \
    REDIS_PORT=6379 \
    MONGO_HOST=mongodb \
    MONGO_PORT=27017 \
    MONGO_URI=mongodb://admin:password@mongodb:27017 \
    MONGO_DB=featbit \
    IS_PRO=false \
    CHECK_DB_LIVNESS=true \
    ENABLE_OPENTELEMETRY=false \
    OTEL_SERVICE_NAME=featbit-das \
    OTEL_TRACES_EXPORTER=otlp \
    OTEL_METRICS_EXPORTER=otlp \
    OTEL_LOGS_EXPORTER=otlp \
    OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
RUN apt update && \
    apt install -y nginx && \ 
    apt install -y supervisor && \ 
    apt install -y git && \ 
    rm -rf /var/lib/apt/lists/*
RUN mkdir -p /var/log/nginx && \
    touch /var/log/nginx/access.log && \
    touch /var/log/nginx/error.log
COPY nginx.conf /etc/nginx/nginx.conf
COPY . /featbit_da
WORKDIR /featbit_da
RUN chmod +x start.sh docker-entrypoint.sh wait-for-it.sh
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt
RUN opentelemetry-bootstrap -a install
EXPOSE 80
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["/usr/bin/supervisord","-c","supervisord.conf"]
