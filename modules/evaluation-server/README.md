# Evaluation Server

## Build & Run

1. `cd ./featbit/modules/evaluation-server`
2. `docker build --progress plain -f ./deploy/Dockerfile -t featbit/evaluation-server .`
3. `docker run -d -p 6000:6000 --name featbit-evaluation-server featbit/evaluation-server`

## Health Check

you have a few options to check the app's health status

### Dump Health Check

**Dump Health Check** don't check that the application can connect to its dependencies, and often only exercise the most
basic requirements of the application itself i.e. can they respond to an HTTP request.

- run `docker inspect featbit-evaluation-server` check if container's STATUS is healthy
- run `curl http://localhost:5000/health/liveness` manually to check the application's liveness

# Environment Variables

## General

| Name           | Description                               | Value     |
|----------------|-------------------------------------------|-----------|
| `AllowedHosts` | Hosts allowed to connect to the API       | `"*"`     |
| `IS_PRO`       | If `true` operates in PRO mode with kafka | `"false"` |

## Logging

| Name                                      | Description                    | Value           |
|-------------------------------------------|--------------------------------|-----------------|
| `Logging__LogLevel__Default`              | Sets the default logging level | `"Information"` |
| `Logging__LogLevel__Microsoft_AspNetCore` | aspnet-core logging level      | `"Warning"`     |

## MongoDB

| Name                        | Description               | Value                                      |
|-----------------------------|---------------------------|--------------------------------------------|
| `MongoDb__ConnectionString` | MongoDB connection string | `"mongodb://admin:password@mongodb:27017"` |
| `MongoDb__Database`         | MongoDB database name     | `"featbit"`                                |

## Redis

| Name                      | Description                                                                        | Value                             |
|---------------------------|------------------------------------------------------------------------------------|-----------------------------------|
| `Redis__ConnectionString` | Redis Connection String                                                            | `"redis:6379,abortConnect=false"` |
| `Redis__Password`         | Redis Password. If provided, override the password specified in connection string. | `""`                              |

## Kafka

Most of the standard [kafka producer configs](https://kafka.apache.org/documentation/#producerconfigs)
and [consumer configs](https://kafka.apache.org/documentation/#consumerconfigs) are available, here are some examples

| Name                                        | Description                                                                         | Value          |
|---------------------------------------------|-------------------------------------------------------------------------------------|----------------|
| `Kafka__Producer__bootstrap.servers`        | Kafka Servers used by producers                                                     | `"kafka:9092"` |
| `Kafka__Producer__linger.ms`                | Delay for batching Kafka messages                                                   | `"50"`         |
| `Kafka__Consumer__bootstrap.servers`        | Kafka Servers used by consumers                                                     | `"kafka:9092"` |
| `Kafka__Consumer__auto.offset.reset`        | Offset reset policy if no initial offset exists                                     | `"latest"`     |
| `Kafka__Consumer__enable.auto.commit`       | Enables auto commit of offset                                                       | `true`         |
| `Kafka__Consumer__auto.commit.interval.ms`  | The frequency in ms that the consumer offsets are auto-committed to Kafka           | `"5000"`       |
| `Kafka__Consumer__enable.auto.offset.store` | Whether to automatically store the offset of the last message prior to calling poll | `false`        |
