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
**Dump Health Check** don't check that the application can connect to its dependencies, and often only exercise the most basic requirements of the application itself i.e. can they respond to an HTTP request.
- run `docker inspect --format '{{json .State.Health}}' featbit-api-dev | jq` check if container's STATUS is healthy
- run `curl http://localhost:5000/health/liveness` manually to check the application's liveness

## Settings

These values are typically set in appsettings.json, but are documented here as they can be set using environment variables.


| Name                                           | Description                                                 | Value                                      |
| ---------------------------------              | ----------------------------------------------------------- | ------------------------------------------ |
| `LOGGING__LOGLEVEL__DEFAULT`                   | Sets the default logging level                              | `"Information"`                            |
| `LOGGING__LOGLEVEL__MICROSOFT_ASPNETCORE`      | aspnet-core logging level                                   | `"Warning"`                                |
| `JWT__ISSUER`                                  | JWT Issuer Name                                             | `"featbit"`                                |
| `JWT__AUDIENCE`                                | JWT Audience                                                | `"featbit-api"`                            |
| `JWT__KEY`                                     | JWT Private Key                                             | `"featbit-identity-key"`                   |
| `MONGODB__CONNECTIONSTRING`                    | Mongodb connection string                                   | `"mongodb://admin:password@mongodb:27017"` |
| `MONGODB__DATABASE`                            | Mongodb database name                                       | `"featbit"`                                |
| `KAFKA__BOOTSTRAPSERVERS`                      | Kafka Servers used by producers and consumers               | `"kafka:9092"`                             |
| `KAFKA__CONSUMERSERVERS`                       | Optional, if set, overrides Kafka Servers used by consumers | `none`                                     |
| `OLAP__SERVICEHOST`                            | URI for the data analytics server                           | `"http://da-server"`                       |
| `REDIS__CONNECTIONSTRING`                      | Redis Connection String                                     | `redis:6379`                               |
| `ALLOWEDHOSTS`                                 | Hosts allowed to connect to the API                         | `"*"`                                      |
| `IS_PRO`                                       | If `true` operates in PRO mode with kafka and clickhouse    | `"false`                                   |