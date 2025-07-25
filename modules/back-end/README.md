# Api

## Prerequisite

- [docker](https://www.docker.com/)
- [jq](https://stedolan.github.io/jq/)

## Build & Run

1. `cd ./featbit/modules/back-end`
2. `docker build --progress plain -f ./deploy/Dockerfile -t featbit/api:local .`
3. `docker run -d -p 5000:5000 --name featbit-api-local featbit/api:local`

## Default User

- username: test@featbit.com
- password: 123456

## Health Check

you have a few options to check the app's health status

### Liveness

Run `curl http://localhost:5000/health/liveness` to verify that the application has not crashed. This does not check
that the application can connect to its dependencies, and often only exercises the most basic requirements of the
application itself i.e. can they respond to an HTTP request.

### Readiness

Run `curl http://localhost:5000/health/readiness` to verify if the application is working correctly, that it can service
requests, and that it can connect to its dependencies (a database, message queue, or other API, for example).

## Environment Variables

### General

| Name            | Description                                                                 | Default Value |
|-----------------|-----------------------------------------------------------------------------|---------------|
| `AllowedHosts`  | Hosts allowed to connect to the API                                         | `"*"`         |
| `DbProvider`    | Database provider, used to select **MongoDB** or **Postgres**               | `"Postgres"`  |
| `MqProvider`    | Message Queue provider, used to select **Redis**, **Kafka** or **Postgres** | `"Postgres"`  |
| `CacheProvider` | Cache provider, used to select **Redis** or **None**                        | `"None"`      |

## Logging

| Name                                               | Description                                      | Default Value                                                                                |
|----------------------------------------------------|--------------------------------------------------|----------------------------------------------------------------------------------------------|
| `Logging__MinimumLevel__Default`                   | Default log level                                | `"Information"`                                                                              |
| `Logging__MinimumLevel__Override__<SourceContext>` | Override log level for a specific source context | Example: `env "Logging__MinimumLevel__Override__Microsoft.EntityFrameworkCore=Information" ` |

### JWT

JWT (JSON Web Token) configuration for authentication and authorization.

| Name            | Description     | Default Value                                           |
|-----------------|-----------------|---------------------------------------------------------|
| `Jwt__Issuer`   | JWT Issuer Name | `"featbit"`                                             |
| `Jwt__Audience` | JWT Audience    | `"featbit-api"`                                         |
| `Jwt__Key`      | JWT Private Key | `"featbit-identity-key-must-longer-than-32-characters"` |

> [!IMPORTANT]
> **Security Notice**: You must change the `Jwt__Key` value to a secure, randomly generated key that is at least 32
> characters long.
>
> - **Recommended length**: 64 characters (32 characters minimum)
> - **Generation**: Use a cryptographically secure random generator or tools like [JWT Secrets](https://jwtsecrets.com/)
> - **Storage**: Keep this key secret and never commit it to version control
>
> This key is used for signing JWT tokens and must remain consistent across all API instances.

### MongoDB

| Name                        | Description               | Default Value                              |
|-----------------------------|---------------------------|--------------------------------------------|
| `MongoDb__ConnectionString` | Mongodb connection string | `"mongodb://admin:password@mongodb:27017"` |
| `MongoDb__Database`         | Mongodb database name     | `"featbit"`                                |

## Postgres

| Name                         | Description                                                                                      | Default Value                                                                            |
|------------------------------|--------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------|
| `Postgres__ConnectionString` | Postgres connection string                                                                       | `"Host=postgres;Port=5432;Username=postgres;Password=please_change_me;Database=featbit"` |
| `Postgres__Password`         | Postgres password (Optional). If provided, override the password specified in connection string. | `""`                                                                                     |

### Redis

| Name                      | Description                                                                                  | Default Value  |
|---------------------------|----------------------------------------------------------------------------------------------|----------------|
| `Redis__ConnectionString` | Redis Connection String                                                                      | `"redis:6379"` |
| `Redis__Password`         | Redis Password (Optional). If provided, override the password specified in connection string | `""`           |

### Kafka

Most of the standard [kafka producer configs](https://kafka.apache.org/documentation/#producerconfigs)
and [consumer configs](https://kafka.apache.org/documentation/#consumerconfigs) are available, here are some examples

| Name                                        | Description                                                                         | Default Value   |
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

| Name                | Description                       | Default Value        |
|---------------------|-----------------------------------|----------------------|
| `OLAP__ServiceHost` | URI for the data analytics server | `"http://da-server"` |