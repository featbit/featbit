# build stage
# https://hub.docker.com/_/microsoft-dotnet
ARG INSTALL_DIR=/app

FROM --platform=$BUILDPLATFORM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG TARGETARCH
WORKDIR /source

# The build context is `modules/`, not `modules/back-end/`, because this module references the
# shared observability projects under `modules/shared/`. The control-plane image has always built
# this way for the same reason (it references back-end projects), so the pattern is not new here.
#
# Copy only project files first, for better Docker layer caching. Important: don't use wildcards
# that flatten paths; copy into the actual project folders. The old flattening `mv` loop cannot be
# used now that the context spans two module directories, because it would collide the shared
# projects with the module's own.
COPY back-end/*.slnx ./back-end/

COPY back-end/src/Api/Api.csproj ./back-end/src/Api/
COPY back-end/src/Application/Application.csproj ./back-end/src/Application/
COPY back-end/src/Domain/Domain.csproj ./back-end/src/Domain/
COPY back-end/src/Infrastructure/Infrastructure.csproj ./back-end/src/Infrastructure/

COPY back-end/tests/Api.UnitTests/Api.UnitTests.csproj ./back-end/tests/Api.UnitTests/
COPY back-end/tests/Application.IntegrationTests/Application.IntegrationTests.csproj ./back-end/tests/Application.IntegrationTests/
COPY back-end/tests/Application.UnitTests/Application.UnitTests.csproj ./back-end/tests/Application.UnitTests/
COPY back-end/tests/Domain.UnitTests/Domain.UnitTests.csproj ./back-end/tests/Domain.UnitTests/
COPY back-end/tests/Infrastructure.IntegrationTests/Infrastructure.IntegrationTests.csproj ./back-end/tests/Infrastructure.IntegrationTests/
COPY back-end/tests/Infrastructure.UnitTests/Infrastructure.UnitTests.csproj ./back-end/tests/Infrastructure.UnitTests/
COPY back-end/tests/TestBase/TestBase.csproj ./back-end/tests/TestBase/

COPY shared/Observability/Observability.csproj ./shared/Observability/
COPY shared/Observability.AspNetCore/Observability.AspNetCore.csproj ./shared/Observability.AspNetCore/
COPY shared/Observability.TestKit/Observability.TestKit.csproj ./shared/Observability.TestKit/
COPY shared/Observability.Tests/Observability.Tests.csproj ./shared/Observability.Tests/

RUN dotnet restore ./back-end/Backend.slnx -a $TARGETARCH

# copy everything else
COPY back-end/. ./back-end/
COPY shared/. ./shared/

# publish stage
FROM build AS publish
ARG INSTALL_DIR
WORKDIR /source/back-end/src/Api
RUN dotnet publish -a $TARGETARCH --no-restore -o $INSTALL_DIR

# final stage/image
FROM mcr.microsoft.com/dotnet/aspnet:10.0

RUN apt-get update && apt-get install -y curl unzip && rm -rf /var/lib/apt/lists/*

ARG INSTALL_DIR
ARG OTEL_VERSION=1.16.0

# ensure we listen on any IP Address
ENV ASPNETCORE_URLS=http://*:5000 \
    INSTALL_DIR=$INSTALL_DIR \
    DOTNET_ADDITIONAL_DEPS=$INSTALL_DIR/AdditionalDeps \
    DOTNET_SHARED_STORE=$INSTALL_DIR/store \
    ENABLE_OPENTELEMETRY=false \
    OTEL_DOTNET_AUTO_HOME=$INSTALL_DIR \
    OTEL_SERVICE_NAME=featbit-api \
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
COPY --from=build /source/back-end/start.sh ./start.sh
RUN chmod +x ./start.sh
EXPOSE 5000

# health check
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD curl --fail --silent http://localhost:5000/health/liveness || exit 1

USER $APP_UID
ENTRYPOINT ["./start.sh"]
