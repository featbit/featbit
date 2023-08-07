## Build

To build the ui-api-bundle image:

```bash
cd featbit
docker build --progress plain -f docker/ui-api-bundle/Dockerfile -t featbit/ui-api-bundle:dev .
```

## Run

If you have MongoDB, Redis and DA-Server running as Docker containers, you can use the following command in PowerShell to start the
application:

```powershell
docker run -d `
-p 8081:80 `
-e MongoDb__ConnectionString="mongodb://admin:password@host.docker.internal:27017" `
-e MongoDb__Database="featbit" `
-e Redis__ConnectionString="host.docker.internal:6379" `
-e OLAP__ServiceHost="http://host.docker.internal:8200" `
-e EVALUATION_URL="http://localhost:5100" `
--name ui-api-bundle featbit/ui-api-bundle:dev
```

## Docker Compose

```powershell
cd featbit
docker compose -f ./docker/ui-api-bundle/docker-compose-dev.yml up -d
```