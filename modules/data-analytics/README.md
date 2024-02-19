# DATA-ANALYTICS is an open source online analytical component, built for FeatBit

* Deploy on your own infrastructure to keep control of your data.
* Track every event on your website or app
* Understand your users and how to improve your product via A/B/N test

## Build & Run on local

We recommend you to run it via:

```bash
git clone https://github.com/featbit/featbit.git
cd featbit/
docker compose up da-server -d
```

## Environment variables

### General

| Name               | Description                                              | Value          |
|--------------------|----------------------------------------------------------|----------------|
| `IS_PRO`           | If `true` operates in PRO mode with kafka and clickhouse | `"false"`      |
| `CHECK_DB_LIVNESS` | Whether to check db liveness on app startup              | `"true"`       |
| `CACHE_TYPE`       | Type of cache used                                       | `"RedisCache"` |
| `TEST`             | If `true`, runs the application in test mode             | `"false"`      |

Note that set CHECK_DB_LIVNESS to **false** if you use external mongodb or clickhouse

### Kafka Settings

| Name                      | Description                     | Value          |
|---------------------------|---------------------------------|----------------|
| `KAFKA_HOSTS`             | Kafka servers used by producers | `"kafka:9092"` |
| `KAFKA_SECURITY_PROTOCOL` | Security protocol used by Kafka | `"PLAINTEXT"`  |
| `KAFKA_SASL_MECHANISM`    | SASL mechanism used by Kafka    | `""`           |
| `KAFKA_SASL_USER`         | SASL user for Kafka             | `""`           |
| `KAFKA_SASL_PASSWORD`     | SASL password for Kafka         | `""`           |

### ClickHouse Settings

| Name                     | Description                                        | Value                  |
|--------------------------|----------------------------------------------------|------------------------|
| `CLICKHOUSE_HOST`        | Hostname of the ClickHouse server                  | `"clickhouse-server"`  |
| `CLICKHOUSE_ALT_HOST`    | Alternate hostname for the ClickHouse server       | `""`                   |
| `CLICKHOUSE_PORT`        | Port of the ClickHouse server                      | `9000`                 |
| `CLICKHOUSE_HTTP_PORT`   | HTTP port of the ClickHouse server                 | `8123`                 |
| `CLICKHOUSE_KAFKA_HOSTS` | Kafka Servers used for Consumers                   | `"kafka:9092"`         |
| `CLICKHOUSE_USER`        | User for ClickHouse server                         | `"default"`            |
| `CLICKHOUSE_PASSWORD`    | Password for ClickHouse server                     | `""`                   |
| `CLICKHOUSE_DATABASE`    | Database name in ClickHouse server                 | `"featbit"`            |
| `CLICKHOUSE_CLUSTER`     | ClickHouse cluster name                            | `"featbit_ch_cluster"` |
| `CLICKHOUSE_REPLICATION` | If `true`, enables replication in ClickHouse       | `"true"`               |
| `CLICKHOUSE_SECURE`      | If `true`, enables secure connection to ClickHouse | `"false"`              |
| `CLICKHOUSE_VERIFY`      | If `true`, verifies the ClickHouse connection      | `"true"`               |

### Redis Settings

| Name                             | Description                        | Value               |
|----------------------------------|------------------------------------|---------------------|
| `REDIS_USER`                     | User for Redis server              | `""`                |
| `REDIS_PASSWORD`                 | Password for Redis server          | `""`                |
| `REDIS_DB`                       | Database number for Redis server   | `0`                 |
| `REDIS_SSL`                      | If `true`, enables SSL for Redis   | `"false"`           |
| `REDIS_HOST`                     | Hostname of the Redis server       | `"localhost"`       |
| `REDIS_PORT`                     | Port of the Redis server           | `6379`              |
| `REDIS_CLUSTER_HOST_PORT_PAIRS`  | Host-port pairs for Redis cluster  | `"localhost:6379"`  |
| `REDIS_SENTINEL_HOST_PORT_PAIRS` | Host-port pairs for Redis sentinel | `"localhost:26379"` |
| `REDIS_SENTINEL_PASSWORD`        | Password for Redis sentinel        | `""`                |
| `REDIS_SENTINEL_MASTER_SET`      | Master set for Redis sentinel      | `"mymaster"`        |

### MongoDB Settings

| Name                    | Description                             | Value                                      |
|-------------------------|-----------------------------------------|--------------------------------------------|
| `MONGO_HOST`            | Mongodb host, used to check db liveness | `"mongodb"`                                |
| `MONGO_PORT`            | Mongodb port, used to check db liveness | `27017`                                    |
| `MONGO_URI`             | Mongodb connection string               | `"mongodb://admin:password@mongodb:27017"` |
| `MONGO_INITDB_DATABASE` | Mongodb database name                   | `"featbit"`                                |
