# Api

## Build & Run
1. `cd ./featbit/modules/back-end`
2. `docker build --progress plain -f ./depoly/Dockerfile -t featbit/api .`
3. `docker run -d -p 5000:5000 --name featbit-api featbit/api`

## Health Check
you have a few options to check the app's health status
### Dump Health Check
**Dump Health Check** don't check that the application can connect to its dependencies, and often only exercise the most basic requirements of the application itself i.e. can they respond to an HTTP request.
- run `docker inspect --format '{{json .State.Health}}' featbit-evaluation-server | jq` check if container's STATUS is healthy
- run `curl http://localhost:5000/health/liveness` manually to check the application's liveness