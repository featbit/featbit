# Api

## Prerequisite

- [docker](https://www.docker.com/)
- [jq](https://stedolan.github.io/jq/)

## Build & Run

1. `cd ./featbit`
2. `docker-compose -f .\docker-compose-dev.yml up -d api`
3. run `docker inspect --format '{{json .State}}' featbit-mongodb-dev | jq` to check mongodb's status
4. run `docker inspect --format '{{json .State.Health}}' featbit-api-dev | jq` to check api service's health status
5. open http://localhost:5000/swagger

## Default User

- username: test@featbit.com
- password: 123456

## Health Check

you have a few options to check the app's health status

### Dump Health Check

**Dump Health Check** don't check that the application can connect to its dependencies, and often only exercise the most
basic requirements of the application itself i.e. can they respond to an HTTP request.

- run `docker inspect --format '{{json .State.Health}}' featbit-api-dev | jq` check if container's STATUS is healthy
- run `curl http://localhost:5000/health/liveness` manually to check the application's liveness

## Environment Variables

### General

| Name           | Description                               | Value   |
|----------------|-------------------------------------------|---------|
| `AllowedHosts` | Hosts allowed to connect to the API       | `"*"`   |
| `IS_PRO`       | If `true` operates in PRO mode with kafka | `false` |

### Logging

| Name                                      | Description                    | Value           |
|-------------------------------------------|--------------------------------|-----------------|
| `Logging__LogLevel__Default`              | Sets the default logging level | `"Information"` |
| `Logging__LogLevel__Microsoft_AspNetCore` | aspnet-core logging level      | `"Warning"`     |

### JWT

| Name            | Description     | Value                    |
|-----------------|-----------------|--------------------------|
| `Jwt__Issuer`   | JWT Issuer Name | `"featbit"`              |
| `Jwt__Audience` | JWT Audience    | `"featbit-api"`          |
| `Jwt__Key`      | JWT Private Key | `"featbit-identity-key"` |

### MongoDB

| Name                        | Description               | Value                                      |
|-----------------------------|---------------------------|--------------------------------------------|
| `MongoDb__ConnectionString` | Mongodb connection string | `"mongodb://admin:password@mongodb:27017"` |
| `MongoDb__Database`         | Mongodb database name     | `"featbit"`                                |

### Redis

| Name                      | Description                                                                       | Value          |
|---------------------------|-----------------------------------------------------------------------------------|----------------|
| `Redis__ConnectionString` | Redis Connection String                                                           | `"redis:6379"` |
| `Redis__Password`         | Redis Password. If provided, override the password specified in connection string | `""`           |

### Kafka

Most of the standard [kafka producer configs](https://kafka.apache.org/documentation/#producerconfigs)
and [consumer configs](https://kafka.apache.org/documentation/#consumerconfigs) are available, here are some examples

| Name                                        | Description                                                                         | Value           |
|---------------------------------------------|-------------------------------------------------------------------------------------|-----------------|
| `Kafka__Producer__bootstrap.servers`        | Kafka Servers used by producers                                                     | `"kafka:9092"`  |
| `Kafka__Producer__linger.ms`                | Delay for batching Kafka messages                                                   | `"50"`          |
| `Kafka__Consumer__group.id`                 | Group ID for Kafka consumers                                                        | `"featbit-api"` |
| `Kafka__Consumer__bootstrap.servers`        | Kafka Servers used by consumers                                                     | `"kafka:9092"`  |
| `Kafka__Consumer__auto.offset.reset`        | Offset reset policy if no initial offset exists                                     | `"earliest"`    |
| `Kafka__Consumer__enable.auto.commit`       | Enables auto commit of offset                                                       | `true`          |
| `Kafka__Consumer__auto.commit.interval.ms`  | The frequency in ms that the consumer offsets are auto-committed to Kafka           | `"5000"`        |
| `Kafka__Consumer__enable.auto.offset.store` | Whether to automatically store the offset of the last message prior to calling poll | `false`         |

### OLAP

| Name                | Description                       | Value                |
|---------------------|-----------------------------------|----------------------|
| `OLAP__ServiceHost` | URI for the data analytics server | `"http://da-server"` |