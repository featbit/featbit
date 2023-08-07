# build backend start

# https://hub.docker.com/_/microsoft-dotnet
FROM mcr.microsoft.com/dotnet/sdk:6.0 as backendBuilder
WORKDIR /backend

# copy sln
COPY modules/back-end/*.sln .

# copy src project files
COPY modules/back-end/src/*/*.csproj ./
RUN for file in $(ls *.csproj); do mkdir -p src/${file%.*}/ && mv $file src/${file%.*}/; done

# copy test project files
COPY modules/back-end/tests/*/*.csproj ./
RUN for file in $(ls *.csproj); do mkdir -p tests/${file%.*}/ && mv $file tests/${file%.*}/; done

RUN dotnet restore

# copy all source, build and test
COPY modules/back-end/ .
RUN dotnet build -c Release --no-restore && dotnet test

# publish
WORKDIR /backend/src/Api
RUN dotnet publish -r linux-x64 --self-contained -c Release -o /backend/publish

# build backend end

# build frontend start

FROM node:16.17 as frontendBuilder

WORKDIR /frontend
COPY modules/front-end/package*.json .
RUN npm install
COPY modules/front-end/ .

RUN npm run build:prod

# build frontend end

# run app
FROM nginx:1.23

RUN apt-get update -y && apt-get install gettext-base && apt-get install tini

COPY --from=frontendBuilder /frontend/dist/featbit/ /app/frontend
COPY --from=backendBuilder /backend/publish /app/backend

COPY docker/ui-api-bundle/nginx.conf /etc/nginx/conf.d/default.conf

ENV ASPNETCORE_CONTENTROOT=/app/backend
ENV ASPNETCORE_URLS=http://localhost:5000

COPY docker/ui-api-bundle/docker-entrypoint.sh /app
RUN chmod +x /app/docker-entrypoint.sh
ENTRYPOINT ["/usr/bin/tini", "--", "/app/docker-entrypoint.sh"]