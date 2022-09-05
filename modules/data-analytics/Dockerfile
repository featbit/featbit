FROM python:3.9-slim-buster
ARG KAFKA_HOSTS=kafka:9092
ARG CLICKHOUSE_HOST=clickhouse-server
ARG CLICKHOUSE_KAFKA_HOSTS=kafka:9092
ARG TEST=false
ARG SUFFIX=
ARG CLICKHOUSE_USER=default
ARG CLICKHOUSE_PASSWORD=
ENV KAFKA_HOSTS=${KAFKA_HOSTS} \
    CLICKHOUSE_USER=${CLICKHOUSE_USER} \
    CLICKHOUSE_PASSWORD=${CLICKHOUSE_PASSWORD} \
    CLICKHOUSE_HOST=${CLICKHOUSE_HOST} \
    CLICKHOUSE_KAFKA_HOSTS=${CLICKHOUSE_KAFKA_HOSTS} \
    TEST=${TEST} \
    SUFFIX=${SUFFIX}
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