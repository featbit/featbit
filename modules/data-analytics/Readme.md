# DATA-ANALYTICS is an open source online analytical component, built for FeatBit

* Deploy on your own infrastructure to keep control of your data.
* Track every event on your website or app
* Understand your users and how to improve your product via A/B/N test

## Build & Run on local

We recommend you to run it via:

```
git clone https://github.com/featbit/featbit.git

cd featbit/

# run on prod
docker compose up da-server -d

# run on dev
docker-compose -f docker-compose-dev.yml up da-server -d      

```

## Settings

| Name                               | Description                                                 | Value                                        |
| ---------------------------------- | ----------------------------------------------------------- | -------------------------------------------- |
| `IS_PRO`                           | If `true` operates in PRO mode with kafka and clickhouse    | `"False"`                                    |
| `WSGI`                             |                                                             | `"False"`                                    |
| `TEST`                             |                                                             | `"True"`                                     |
| `SUFFIX`                           |                                                             | `""`                                         |
| `KAFKA_HOSTS`                      | Kafka servers used by producers                             | `"localhost:29092"`                          |
| `KAFKA_SECURITY_PROTOCOL`          |                                                             | `None`                                       | 
| `KAFKA_SASL_MECHANISM`             |                                                             | `None`                                       |
| `KAFKA_SASL_USER`                  |                                                             | `None`                                       |
| `KAFKA_SASL_PASSWORD`              |                                                             | `None`                                       |
| `KAFKA_PRODUCER_ENABLED`           |                                                             | `"True"`                                     |
| `KAFKA_PREFIX`                     |                                                             | `""`                                         |
| `CLICKHOUSE_HOST`                  |                                                             | `"localhost"`                                |
| `CLICKHOUSE_CLUSTER`               |                                                             | `"featbit_ch_cluster"`                       |
| `CLICKHOUSE_DATABASE`              |                                                             | `"featbit"` + SUFFIX                         |
| `CLICKHOUSE_SECURE`                |                                                             | `"False"`                                    |
| `CLICKHOUSE_USER`                  |                                                             | `"default"`                                  |
| `CLICKHOUSE_PASSWORD`              |                                                             | `""`                                         |
| `CLICKHOUSE_CA`                    |                                                             | `"None"`                                     |
| `CLICKHOUSE_VERIFY`                |                                                             | `"True"`                                     |
| `CLICKHOUSE_CONN_POOL_MIN`         |                                                             | `20`                                         |
| `CLICKHOUSE_CONN_POOL_MAX`         |                                                             | `1000`                                       |
| `CLICKHOUSE_ENABLE_STORAGE_POLICY` |                                                             | `"False"`                                    |
| `CLICKHOUSE_KAFKA_HOSTS`           | Kafka Servers used for Consumers                            | `"kafka:9092"`                               |
| `CLICKHOUSE_REPLICATION`           |                                                             | `"True"`                                     |
| `REDIS_URL`                        |                                                             | `"redis://localhost:6379/0"`                 |
| `MONGO_URI`                        |                                                             | `"mongodb://admin:password@localhost:27017"` |
| `MONGODB_DB`                       | Mongodb database name                                       | `"featbit"`                                  |
