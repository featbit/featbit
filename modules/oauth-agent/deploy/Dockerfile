# build stage
# https://hub.docker.com/_/microsoft-dotnet
FROM mcr.microsoft.com/dotnet/sdk:7.0 AS build
WORKDIR /source

COPY src/oauth-agent-dotnet/*.csproj ./
COPY src/oauth-agent-dotnet/src ./
COPY src/oauth-agent-dotnet/appsettings.json ./
COPY src/oauth-agent-dotnet/appsettings-dev.json ./

# RUN ls -R ./

RUN dotnet restore

RUN dotnet build -c Debug --no-restore

# publish stage
FROM build AS publish
WORKDIR /source
RUN dotnet publish -c Debug --no-build -o /app

# final stage/image
FROM mcr.microsoft.com/dotnet/aspnet:7.0
WORKDIR /app
COPY --from=publish /app ./
# ensure we listen on any IP Address
ENV ASPNETCORE_URLS=http://*:8082
EXPOSE 8082

# health check
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD curl --fail --silent http://localhost:8082/health/liveness || exit 1

ENTRYPOINT ["dotnet", "oauth-agent.dll"]
