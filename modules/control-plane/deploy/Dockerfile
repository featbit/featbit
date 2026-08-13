# build stage
# https://hub.docker.com/_/microsoft-dotnet
ARG INSTALL_DIR=/app

FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG TARGETARCH
WORKDIR /source

# Copy only solution + csproj files first for better Docker layer caching.
# Important: don't use wildcards that flatten paths; copy into the actual project folders.
COPY control-plane/*.slnx ./control-plane/

COPY control-plane/src/Api/Api.csproj ./control-plane/src/Api/
COPY control-plane/tests/Api.UnitTests/Api.UnitTests.csproj ./control-plane/tests/Api.UnitTests/
COPY control-plane/tests/Api.IntegrationTests/Api.IntegrationTests.csproj ./control-plane/tests/Api.IntegrationTests/

COPY back-end/src/Application/Application.csproj ./back-end/src/Application/
COPY back-end/src/Domain/Domain.csproj ./back-end/src/Domain/
COPY back-end/src/Infrastructure/Infrastructure.csproj ./back-end/src/Infrastructure/

# Restore using the forced NuGet config
RUN dotnet restore ./control-plane/ControlPlane.slnx -a $TARGETARCH

# Copy the remaining sources
COPY control-plane/. ./control-plane/

# Copy only the referenced back-end project sources (not the whole back-end repo)
COPY back-end/src/Application/. ./back-end/src/Application/
COPY back-end/src/Domain/. ./back-end/src/Domain/
COPY back-end/src/Infrastructure/. ./back-end/src/Infrastructure/

# publish stage
FROM build AS publish
ARG INSTALL_DIR
WORKDIR /source/control-plane/src/Api

RUN dotnet publish -a $TARGETARCH --no-restore -o $INSTALL_DIR

# final stage/image
FROM mcr.microsoft.com/dotnet/aspnet:10.0

RUN apt-get update && apt-get install -y curl unzip && rm -rf /var/lib/apt/lists/*

ARG INSTALL_DIR
ARG OTEL_VERSION=1.16.0

# ensure we listen on any IP Address
ENV ASPNETCORE_URLS=http://*:5200 \
    INSTALL_DIR=$INSTALL_DIR \
    DOTNET_ADDITIONAL_DEPS=$INSTALL_DIR/AdditionalDeps \
    DOTNET_SHARED_STORE=$INSTALL_DIR/store \
    ENABLE_OPENTELEMETRY=false \
    OTEL_DOTNET_AUTO_HOME=$INSTALL_DIR \
    OTEL_SERVICE_NAME=featbit-control-plane \
    OTEL_TRACES_EXPORTER=otlp \
    OTEL_METRICS_EXPORTER=otlp \
    OTEL_LOGS_EXPORTER=otlp \
    OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317 \
    OTEL_EXPORTER_OTLP_PROTOCOL=grpc \
    OTEL_EXPORTER_OTLP_INSECURE=true

ADD https://github.com/open-telemetry/opentelemetry-dotnet-instrumentation/releases/download/v${OTEL_VERSION}/otel-dotnet-auto-install.sh otel-dotnet-auto-install.sh
RUN chmod +x otel-dotnet-auto-install.sh
RUN ./otel-dotnet-auto-install.sh

ARG VERSION=dev
ENV VERSION=$VERSION

WORKDIR $INSTALL_DIR
COPY --from=publish $INSTALL_DIR ./
COPY --from=build /source/control-plane/start.sh ./start.sh
RUN chmod +x ./start.sh

EXPOSE 5200

HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD curl --fail --silent http://localhost:5200/health/liveness || exit 1

USER $APP_UID
ENTRYPOINT ["./start.sh"]