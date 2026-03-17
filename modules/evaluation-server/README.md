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
| `DbProvider`    | Database provider, used to select **MongoDB** or **Postgres**               | `"Postgres"`  |
| `MqProvider`    | Message Queue provider, used to select **Redis**, **Kafka** or **Postgres** | `"Postgres"`  |
| `CacheProvider` | Cache provider, used to select **Redis** or **None**                        | `"None"`      |

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

| Name                         | Description                                                                                      | Default Value                                                                            |
|------------------------------|--------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------|
| `Postgres__ConnectionString` | Postgres connection string                                                                       | `"Host=postgres;Port=5432;Username=postgres;Password=please_change_me;Database=featbit"` |
| `Postgres__Password`         | Postgres password (Optional). If provided, override the password specified in connection string. | `""`                                                                                     |

## Redis

| Name                      | Description                                                                                   | Default Value  |
|---------------------------|-----------------------------------------------------------------------------------------------|----------------|
| `Redis__ConnectionString` | Redis Connection String                                                                       | `"redis:6379"` |
| `Redis__Password`         | Redis Password (Optional). If provided, override the password specified in connection string. | `""`           |

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

## Streaming

| Name                             | Description                                                  | Default Value |
|----------------------------------|--------------------------------------------------------------|---------------|
| `Streaming__TrackClientHostName` | Whether to resolve client's IP hostname for detailed logging | `true`        |
| `Streaming__TokenExpirySeconds`  | Streaming token expiry time in seconds                       | `30`          |

## Rate Limiting

Rate limiting **is disabled by default**. When enabled, it protects the API from excessive traffic using one of three
algorithms: **FixedWindow**, **SlidingWindow**, or **TokenBucket**. Limits can be configured globally and overridden
per endpoint.

> [!IMPORTANT]
> Before enabling rate limiting in production, be sure to have a clear understanding of your traffic patterns and load
> test your configuration to ensure limits are appropriate and effective.

### Global Options

| Name                                       | Description                                                                                                        | Default Value   |
|--------------------------------------------|--------------------------------------------------------------------------------------------------------------------|-----------------|
| `RateLimiting__Enabled`                    | Whether rate limiting is enabled                                                                                   | `false`         |
| `RateLimiting__Distributed`                | Use Redis for distributed rate limiting across multiple instances. Requires `CacheProvider` to be set to `"Redis"` | `false`         |
| `RateLimiting__Type`                       | Rate limiter algorithm: `FixedWindow`, `SlidingWindow`, or `TokenBucket`                                           | `"FixedWindow"` |
| `RateLimiting__QueueLimit`                 | Maximum number of requests queued when the limit is reached                                                        | `0`             |
| `RateLimiting__PermitLimit`                | Maximum number of requests allowed in the time window. Used by `FixedWindow` and `SlidingWindow`                   | `100`           |
| `RateLimiting__WindowSeconds`              | Length of the time window in seconds (1–86400). Used by `FixedWindow` and `SlidingWindow`                          | `60`            |
| `RateLimiting__SegmentsPerWindow`          | Number of segments the window is divided into. Only used by `SlidingWindow`                                        | `4`             |
| `RateLimiting__TokenLimit`                 | Maximum number of tokens in the bucket. Only used by `TokenBucket`                                                 | `100`           |
| `RateLimiting__TokensPerPeriod`            | Number of tokens added per replenishment period. Only used by `TokenBucket`                                        | `50`            |
| `RateLimiting__ReplenishmentPeriodSeconds` | Time between token replenishments in seconds (1–86400). Only used by `TokenBucket`                                 | `60`            |

### Per-Endpoint Overrides

The following endpoint keys are supported. Each key maps to the routes listed below:

| Key           | Routes                                                                                | Description                                                                  |
|---------------|---------------------------------------------------------------------------------------|------------------------------------------------------------------------------|
| `Sdk`         | `GET /api/public/sdk/server/latest-all` <br> `POST /api/public/sdk/client/latest-all` | Used by FeatBit SDKs to fetch the latest feature flags via polling           |
| `Insight`     | `POST /api/public/insight/track`                                                      | Used by FeatBit SDKs to track flag evaluation results and A/B testing events |
| `FeatureFlag` | `POST /api/public/featureflag/evaluate`                                               | Used to evaluate feature flag variations for a given user                    |
| `Agent`       | `POST /api/public/agent/register`                                                     | Used to register relay proxy agents                                          |

The environment variable pattern is `RateLimiting__Endpoints__<Key>__<Property>`, for example
`RateLimiting__Endpoints__Sdk__PermitLimit` overrides `PermitLimit` for the `Sdk` endpoint.

Notes:
- Any property not specified for an endpoint key inherits from the global defaults above. 
- All per-endpoint properties are optional and omit any property to fall back to the global value.
