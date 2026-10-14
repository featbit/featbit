# build stage
# https://hub.docker.com/_/microsoft-dotnet
ARG INSTALL_DIR=/app

FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG TARGETARCH
WORKDIR /source

# The build context is `modules/`, not `modules/evaluation-server/`, because this module references
# the shared observability projects under `modules/shared/`. The control-plane image has always
# built this way for the same reason (it references back-end projects), so the pattern is not new
# here.
#
# Copy only project files first, for better Docker layer caching. Important: don't use wildcards
# that flatten paths; copy into the actual project folders. The old flattening `mv` loop cannot be
# used now that the context spans two module directories, because it would collide the shared
# projects with the module's own.
COPY evaluation-server/*.slnx ./evaluation-server/

# Applies to every project under evaluation-server/src, so restore needs it before the sources.
COPY evaluation-server/src/Directory.Build.props ./evaluation-server/src/
COPY evaluation-server/src/icon.png ./evaluation-server/src/

COPY evaluation-server/src/Api/Api.csproj ./evaluation-server/src/Api/
COPY evaluation-server/src/Domain/Domain.csproj ./evaluation-server/src/Domain/
COPY evaluation-server/src/Infrastructure/Infrastructure.csproj ./evaluation-server/src/Infrastructure/
COPY evaluation-server/src/Streaming/Streaming.csproj ./evaluation-server/src/Streaming/

COPY evaluation-server/tests/Application.IntegrationTests/Application.IntegrationTests.csproj ./evaluation-server/tests/Application.IntegrationTests/
COPY evaluation-server/tests/Domain.UnitTests/Domain.UnitTests.csproj ./evaluation-server/tests/Domain.UnitTests/
COPY evaluation-server/tests/Infrastructure.IntegrationTests/Infrastructure.IntegrationTests.csproj ./evaluation-server/tests/Infrastructure.IntegrationTests/
COPY evaluation-server/tests/Infrastructure.UnitTests/Infrastructure.UnitTests.csproj ./evaluation-server/tests/Infrastructure.UnitTests/
COPY evaluation-server/tests/Streaming.UnitTests/Streaming.UnitTests.csproj ./evaluation-server/tests/Streaming.UnitTests/
COPY evaluation-server/tests/TestBase/TestBase.csproj ./evaluation-server/tests/TestBase/

COPY shared/Observability/Observability.csproj ./shared/Observability/
COPY shared/Observability.AspNetCore/Observability.AspNetCore.csproj ./shared/Observability.AspNetCore/
COPY shared/Observability.TestKit/Observability.TestKit.csproj ./shared/Observability.TestKit/
COPY shared/Observability.Tests/Observability.Tests.csproj ./shared/Observability.Tests/

RUN dotnet restore ./evaluation-server/EvaluationServer.slnx -a $TARGETARCH

# copy everything else
COPY evaluation-server/. ./evaluation-server/
COPY shared/. ./shared/

# publish stage
FROM build AS publish
ARG INSTALL_DIR
WORKDIR /source/evaluation-server/src/Api
RUN dotnet publish -a $TARGETARCH --no-restore -o $INSTALL_DIR

# final stage/image
FROM mcr.microsoft.com/dotnet/aspnet:10.0

RUN apt-get update && apt-get install -y curl unzip && rm -rf /var/lib/apt/lists/*

ARG INSTALL_DIR
ARG OTEL_VERSION=1.16.0

# ensure we listen on any IP Address
ENV ASPNETCORE_URLS=http://*:5100 \
    INSTALL_DIR=$INSTALL_DIR \
    DOTNET_ADDITIONAL_DEPS=$INSTALL_DIR/AdditionalDeps \
    DOTNET_SHARED_STORE=$INSTALL_DIR/store \
    ENABLE_OPENTELEMETRY=false \
    OTEL_DOTNET_AUTO_HOME=$INSTALL_DIR \
    OTEL_SERVICE_NAME=featbit-els \
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
COPY --from=build /source/evaluation-server/start.sh ./start.sh
RUN chmod +x ./start.sh
EXPOSE 5100

# health check
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD curl --fail --silent http://localhost:5100/health/liveness || exit 1

USER $APP_UID
ENTRYPOINT ["./start.sh"]
