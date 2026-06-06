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

| Name                  | Description                                                                            | Default Value                                           |
|-----------------------|----------------------------------------------------------------------------------------|---------------------------------------------------------|
| `Jwt__Issuer`         | JWT Issuer Name                                                                        | `"featbit"`                                             |
| `Jwt__Audience`       | JWT Audience                                                                           | `"featbit-api"`                                         |
| `Jwt__Algorithm`      | Signing algorithm. Valid values: `HS256` (symmetric), `RS256` or `ES256` (asymmetric)  | `"HS256"`                                               |
| `Jwt__Key`            | Symmetric secret key — used when `Jwt__Algorithm = HS256`                              | `"featbit-identity-key-must-longer-than-32-characters"` |
| `Jwt__PrivateKeyPath` | Path to a PEM-encoded private key file — used when `Jwt__Algorithm = RS256` or `ES256` | `""`                                                    |
| `Jwt__PublicKeyPath`  | Path to a PEM-encoded public key file — used when `Jwt__Algorithm = RS256` or `ES256`  | `""`                                                    |

> [!IMPORTANT]
> **Security Notice**: Configure JWT signing according to your security requirements.
>
> **HS256 (default — symmetric)**
> - You must change `Jwt__Key` to a secure, randomly generated secret.
> - **Recommended length**: 64 characters (32 characters minimum)
> - **Generation**: Use a cryptographically secure random generator or tools like [JWT Secrets](https://jwtsecrets.com/)
> - **Storage**: Keep this key secret and never commit it to version control
> - This key must remain consistent across all API instances.
>
> **RS256 / ES256 (asymmetric — recommended for production)**
> - Set `Jwt__Algorithm` to `RS256` or `ES256`.
> - Generate a key pair and provide paths to the PEM files via `Jwt__PrivateKeyPath` and `Jwt__PublicKeyPath`.
> - The private key file must be kept secret; only the public key is needed for token validation.
> - In Docker/Kubernetes deployments, mount the key files as secrets and set the paths accordingly.
> - Example key generation:
>   - **RS256**: `openssl genrsa -out jwt-rs-private.pem 2048 && openssl rsa -in jwt-rs-private.pem -pubout -out jwt-rs-public.pem`
>   - **ES256**: `openssl ecparam -name prime256v1 -genkey -noout -out jwt-es-private.pem && openssl ec -in jwt-es-private.pem -pubout -out jwt-es-public.pem`

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

### Feature Flag Insights

| Name                             | Description                                                                                   | Default Value  |
|----------------------------------|-----------------------------------------------------------------------------------------------|----------------|
| `FEATURE_FLAG_INSIGHTS_PROVIDER` | Selects the feature flag usage insights provider. Use `featbit-das` for DA or `featbit-api`. | `"featbit-das"` |
| `FeatureFlagInsights__Provider`  | Configuration-section equivalent of `FEATURE_FLAG_INSIGHTS_PROVIDER`.                         | `"featbit-das"` |

### UsageTracking

| Name                             | Description                                            | Default Value |
|----------------------------------|--------------------------------------------------------|---------------|
| `UsageTracking__FlushIntervalMs` | Interval in milliseconds between usage data flushes    | `5000`        |
| `UsageTracking__ChannelCapacity` | Maximum number of usage events buffered in the channel | `10000`       |
