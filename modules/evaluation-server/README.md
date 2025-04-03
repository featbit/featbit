# Evaluation Server

## Build & Run

1. `cd ./featbit/modules/evaluation-server`
2. `docker build --progress plain -f ./deploy/Dockerfile -t featbit/evaluation-server:local .`
3. `docker run -d -p 5100:5100 --name featbit-evaluation-server-local featbit/evaluation-server:local`

## Health Check

you have a few options to check the app's health status

### Liveness

Run `curl http://localhost:5100/health/liveness` to verify that the application has not crashed. This does not check
that the application can connect to its dependencies, and often only exercises the most basic requirements of the
application itself i.e. can they respond to an HTTP request.

### Readiness

Run `curl http://localhost:5100/health/readiness` to verify if the application is working correctly, that it can service
requests, and that it can connect to its dependencies (a database, message queue, or other API, for example).

# Environment Variables

## General

| Name            | Description                                                                 | Default Value |
|-----------------|-----------------------------------------------------------------------------|---------------|
| `AllowedHosts`  | Hosts allowed to connect to the API                                         | `"*"`         |
| `DbProvider`    | Database provider, used to select **MongoDB** or **Postgres**               | `"MongoDb"`   |
| `MqProvider`    | Message Queue provider, used to select **Redis**, **Kafka** or **Postgres** | `"Redis"`     |
| `CacheProvider` | Cache provider, used to select **Redis** or **None**                        | `"Redis"`     |

## Logging

| Name                                               | Description                                      | Default Value                                                                 |
|----------------------------------------------------|--------------------------------------------------|-------------------------------------------------------------------------------|
| `Logging__MinimumLevel__Default`                   | Default log level                                | `"Information"`                                                               |
| `Logging__MinimumLevel__Override__<SourceContext>` | Override log level for a specific source context | Example: `env "Logging__MinimumLevel__Override__Npgsql.Command=Information" ` |

## MongoDB

| Name                        | Description               | Default Value                              |
|-----------------------------|---------------------------|--------------------------------------------|
| `MongoDb__ConnectionString` | MongoDB connection string | `"mongodb://admin:password@mongodb:27017"` |
| `MongoDb__Database`         | MongoDB database name     | `"featbit"`                                |

## Postgres

| Name                         | Description                | Default Value                                                                        |
|------------------------------|----------------------------|--------------------------------------------------------------------------------------|
| `Postgres__ConnectionString` | Postgres connection string | `"Host=postgres;Port=5432;Username=postgres;Password=0tJXCokSvOB8;Database=featbit"` |

## Redis

| Name                      | Description                                                                                   | Default Value                     |
|---------------------------|-----------------------------------------------------------------------------------------------|-----------------------------------|
| `Redis__ConnectionString` | Redis Connection String                                                                       | `"redis:6379,abortConnect=false"` |
| `Redis__Password`         | Redis Password (Optional). If provided, override the password specified in connection string. | `""`                              |

## Kafka

Most of the standard [kafka producer configs](https://kafka.apache.org/documentation/#producerconfigs)
and [consumer configs](https://kafka.apache.org/documentation/#consumerconfigs) are available, here are some examples

| Name                                        | Description                                                                         | Default Value  |
|---------------------------------------------|-------------------------------------------------------------------------------------|----------------|
| `Kafka__Producer__bootstrap.servers`        | Kafka Servers used by producers                                                     | `"kafka:9092"` |
| `Kafka__Producer__linger.ms`                | Delay for batching Kafka messages                                                   | `"50"`         |
| `Kafka__Consumer__bootstrap.servers`        | Kafka Servers used by consumers                                                     | `"kafka:9092"` |
| `Kafka__Consumer__auto.offset.reset`        | Offset reset policy if no initial offset exists                                     | `"latest"`     |
| `Kafka__Consumer__enable.auto.commit`       | Enables auto commit of offset                                                       | `true`         |
| `Kafka__Consumer__auto.commit.interval.ms`  | The frequency in ms that the consumer offsets are auto-committed to Kafka           | `"5000"`       |
| `Kafka__Consumer__enable.auto.offset.store` | Whether to automatically store the offset of the last message prior to calling poll | `false`        |
