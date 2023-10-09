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

## Settings

These values are typically set in appsettings.json, but are documented here as they can be set using environment
variables.

| Name                                      | Description                                              | Value                                      |
|-------------------------------------------|----------------------------------------------------------|--------------------------------------------|
| `Logging__LogLevel__Default`              | Sets the default logging level                           | `"Information"`                            |
| `Logging__LogLevel__Microsoft_AspNetCore` | aspnet-core logging level                                | `"Warning"`                                |
| `MongoDb__ConnectionString`               | Mongodb connection string                                | `"mongodb://admin:password@mongodb:27017"` |
| `MongoDb__Database`                       | Mongodb database name                                    | `"featbit"`                                |
| `Kafka__Producer__BootstrapServers`       | Kafka Servers used by producers                          | `"kafka:9092"`                             |
| `Kafka__Consumer__BootstrapServers`       | Kafka Servers used by consumers                          | `"kafka:9092"`                             |
| `Redis__ConnectionString`                 | Redis Connection String                                  | `redis:6379`                               |
| `AllowedHosts`                            | Hosts allowed to connect to the API                      | `"*"`                                      |
| `IS_PRO`                                  | If `true` operates in PRO mode with kafka and clickhouse | `"false"`                                  |
