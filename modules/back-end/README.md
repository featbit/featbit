# Api

## Build & Run
1. `cd ./featbit/modules/back-end`
2. `docker build --progress plain -f ./depoly/Dockerfile -t featbit/api .`
3. `docker run -d -p 5000:5000 --name featbit-api featbit/api`