# Evaluation Server

## Build & Run
1. `cd ./featbit/modules/evaluation-server`
2. `docker build --progress plain -f ./deploy/Dockerfile -t featbit/evaluation-server .`
3. `docker run -d -p 6000:6000 --name featbit-evaluation-server featbit/evaluation-server`

## Health Check
you have a few options to check the app's health status
### Dump Health Check
**Dump Health Check** don't check that the application can connect to its dependencies, and often only exercise the most basic requirements of the application itself i.e. can they respond to an HTTP request.
- run `docker inspect featbit-evaluation-server` check if container's STATUS is healthy
- run `curl http://localhost:5000/health/liveness` manually to check the application's liveness


These values are typically set in appsettings.json, but are documented here as they can be set using environment variables.


| Name                                           | Description                                                 | Value                                      |
| ---------------------------------              | ----------------------------------------------------------- | ------------------------------------------ |
| `LOGGING__LOGLEVEL__DEFAULT`                   | Sets the default logging level                              | `"Information"`                            |
| `LOGGING__LOGLEVEL__MICROSOFT_ASPNETCORE`      | aspnet-core logging level                                   | `"Warning"`                                |
| `MONGODB__CONNECTIONSTRING`                    | Mongodb connection string                                   | `"mongodb://admin:password@mongodb:27017"` |
| `MONGODB__DATABASE`                            | Mongodb database name                                       | `"featbit"`                                |
| `KAFKA__BOOTSTRAPSERVERS`                      | Kafka Servers used by producers and consumers               | `"kafka:9092"`                             |
| `KAFKA__CONSUMERSERVERS`                       | Optional, if set, overrides Kafka Servers used by consumers | `none`                                     |
| `REDIS__CONNECTIONSTRING`                      | Redis Connection String                                     | `redis:6379`                               |
| `ALLOWEDHOSTS`                                 | Hosts allowed to connect to the API                         | `"*"`                                      |
| `IS_PRO`                                       | If `true` operates in PRO mode with kafka and clickhouse    | `"false"`                                  |
