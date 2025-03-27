# DATA-ANALYTICS is an open source online analytical component, built for FeatBit

* Deploy on your own infrastructure to keep control of your data.
* Track every event on your website or app
* Understand your users and how to improve your product via A/B/N test

## Build & Run

1. `cd ./featbit/modules/data-analytics/`
2. `docker build --progress plain -f ./Dockerfile -t featbit/data-analytics-server:local .`
3. `docker run -d -p 8200:80 --name featbit-data-analytics-server-local featbit/data-analytics-server:local`

## Environment variables


### General

| Name               | Description                                                   | Default Value  |
|--------------------|---------------------------------------------------------------|----------------|
| `CHECK_DB_LIVNESS` | Whether to check db liveness on app startup                   | `"true"`       |
| `TEST`             | If `true`, runs the application in test mode                  | `"false"`      |
| `DB_PROVIDER`      | Database provider, 3 options: ClickHouse, MongoDB or Postgres | `"MongoDb"`    |

> [!NOTE]
> Set CHECK_DB_LIVNESS to **false** if you use external db.

### Kafka

Make sure assign `ClickHouse` to `DB_PROVIDER`

| Name                      | Description                     | Default Value  |
|---------------------------|---------------------------------|----------------|
| `KAFKA_HOSTS`             | Kafka servers used by producers | `"kafka:9092"` |
| `KAFKA_SECURITY_PROTOCOL` | Security protocol used by Kafka | `"PLAINTEXT"`  |
| `KAFKA_SASL_MECHANISM`    | SASL mechanism used by Kafka    | `""`           |
| `KAFKA_SASL_USER`         | SASL user for Kafka             | `""`           |
| `KAFKA_SASL_PASSWORD`     | SASL password for Kafka         | `""`           |

### ClickHouse

Make sure assign `ClickHouse` to `DB_PROVIDER`

| Name                     | Description                                        | Default Value          |
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

### MongoDb

Make sure assign `MongoDb` to `DB_PROVIDER`

| Name                    | Description                             | Default Value                              |
|-------------------------|-----------------------------------------|--------------------------------------------|
| `MONGO_HOST`            | Mongodb host, used to check db liveness | `"mongodb"`                                |
| `MONGO_PORT`            | Mongodb port, used to check db liveness | `27017`                                    |
| `MONGO_URI`             | Mongodb connection string               | `"mongodb://admin:password@mongodb:27017"` |
| `MONGO_INITDB_DATABASE` | Mongodb database name                   | `"featbit"`                                |

### Postgres

Make sure assign `Postgres` to `DB_PROVIDER`

| Name                | Description                                | Default Value    |
|---------------------|--------------------------------------------|------------------|
| `POSTGRES_USER`     | PostgreSQL port, used to check db liveness | `"postgres`      |
| `POSTGRES_PASSWORD` | PostgreSQL database password               | `"0tJXCokSvOB8"` |
| `POSTGRES_HOST`     | PostgreSQL database host                   | `"postgresql"`   |
| `POSTGRES_PORT`     | PostgreSQL database port                   | `"5432"`         |
| `POSTGRES_DATABASE` | PostgreSQL database name                   | `"featbit"`      |
