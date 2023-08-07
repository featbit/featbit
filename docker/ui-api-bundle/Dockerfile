### build backend

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

### build frontend

FROM node:16.17 as frontendBuilder

WORKDIR /frontend
COPY modules/front-end/package*.json .
RUN npm install
COPY modules/front-end/ .

RUN npm run build:prod

### run app
FROM debian:bullseye-slim

RUN apt-get update -y &&  \
    apt-get install -y gettext-base nginx xz-utils && \
    # forward nginx request and error logs to docker log collector
    ln -sf /dev/stdout /var/log/nginx/access.log &&  \
    ln -sf /dev/stderr /var/log/nginx/error.log

COPY --from=frontendBuilder /frontend/dist/featbit/ /app/frontend
COPY --from=backendBuilder /backend/publish /app/backend

COPY docker/ui-api-bundle/nginx.conf /etc/nginx/nginx.conf

ENV ASPNETCORE_CONTENTROOT=/app/backend \
    ASPNETCORE_URLS=http://localhost:5000 \
    S6_KEEP_ENV=1

# use s6-overlay as  process supervisor
ARG S6_OVERLAY_VERSION=3.1.5.0
ADD https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-noarch.tar.xz /tmp
RUN tar -C / -Jxpf /tmp/s6-overlay-noarch.tar.xz
ADD https://github.com/just-containers/s6-overlay/releases/download/v${S6_OVERLAY_VERSION}/s6-overlay-x86_64.tar.xz /tmp
RUN tar -C / -Jxpf /tmp/s6-overlay-x86_64.tar.xz

# Reference: https://github.com/just-containers/s6-overlay#writing-a-service-script
COPY docker/ui-api-bundle/services.d /etc/services.d

ENTRYPOINT ["/init"]