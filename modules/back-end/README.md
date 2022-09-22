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