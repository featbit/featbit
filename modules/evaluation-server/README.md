# Evaluation Server

## Build & Run
1. `cd ./featbit/modules/evaluation-server`
2. `docker build --progress plain -f ./depoly/Dockerfile -t featbit/evaluation-server .`
3. `docker run -d -p 5000:5000 --name featbit-evaluation-server featbit/evaluation-server`
4. `curl https://localhost:5001/WeatherForecast | jq` to check if the server start successfully
