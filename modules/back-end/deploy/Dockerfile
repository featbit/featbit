# build stage
# https://hub.docker.com/_/microsoft-dotnet
ARG INSTALL_DIR=/app

FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:8.0 AS build
ARG TARGETARCH
WORKDIR /source

# copy sln
COPY *.sln .

# copy src project files
COPY src/*/*.csproj ./
RUN for file in $(ls *.csproj); do mkdir -p src/${file%.*}/ && mv $file src/${file%.*}/; done

# copy test project files
COPY tests/*/*.csproj ./
RUN for file in $(ls *.csproj); do mkdir -p tests/${file%.*}/ && mv $file tests/${file%.*}/; done

RUN dotnet restore -a $TARGETARCH

# copy everything else
COPY . .

# publish stage
FROM build AS publish
ARG INSTALL_DIR
WORKDIR /source/src/Api
RUN dotnet publish -a $TARGETARCH --no-restore -o $INSTALL_DIR

# final stage/image
FROM mcr.microsoft.com/dotnet/aspnet:8.0

RUN apt-get update && apt-get install -y curl unzip && rm -rf /var/lib/apt/lists/*

ARG INSTALL_DIR
ARG OTEL_VERSION=1.7.0

# ensure we listen on any IP Address
ENV ASPNETCORE_URLS=http://*:5000 \
    INSTALL_DIR=$INSTALL_DIR \
    DOTNET_ADDITIONAL_DEPS=$INSTALL_DIR/AdditionalDeps \
    DOTNET_SHARED_STORE=$INSTALL_DIR/store \
    ENABLE_OPENTELEMETRY=false \
    OTEL_DOTNET_AUTO_HOME=$INSTALL_DIR \
    OTEL_SERVICE_NAME=featbit-els \
    OTEL_TRACES_EXPORTER=otlp \
    OTEL_METRICS_EXPORTER=otlp \
    OTEL_LOGS_EXPORTER=otlp \
    OTEL_EXPORTER_OTLP_ENDPOINT=http://locahost:4317 \
    OTEL_EXPORTER_OTLP_PROTOCOL=grpc \
    OTEL_EXPORTER_OTLP_INSECURE=true

ADD https://github.com/open-telemetry/opentelemetry-dotnet-instrumentation/releases/download/v${OTEL_VERSION}/otel-dotnet-auto-install.sh otel-dotnet-auto-install.sh
RUN chmod +x otel-dotnet-auto-install.sh
RUN ./otel-dotnet-auto-install.sh

WORKDIR $INSTALL_DIR
COPY --from=publish $INSTALL_DIR ./
COPY --from=build /source/start.sh ./start.sh
RUN chmod +x ./start.sh
EXPOSE 5000

# health check
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD curl --fail --silent http://localhost:5000/health/liveness || exit 1

USER $APP_UID
ENTRYPOINT ["./start.sh"]