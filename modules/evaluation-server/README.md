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
