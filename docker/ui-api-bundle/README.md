```bash
cd featbit
docker build --progress plain -f docker/ui-api-bundle/Dockerfile -t featbit/ui-api-bundle:local .
docker run --name ui-api-bundle featbit/ui-api-bundle:local -p 8080:80
```