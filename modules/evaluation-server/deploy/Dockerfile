# build stage
# https://hub.docker.com/_/microsoft-dotnet
FROM mcr.microsoft.com/dotnet/sdk:6.0 AS build
WORKDIR /source

# copy sln
COPY *.sln .

# copy Directory.Build.props and icon
COPY src/Directory.Build.props .
COPY src/icon.png .

# copy src project files
COPY src/*/*.csproj ./
RUN for file in $(ls *.csproj); do mkdir -p src/${file%.*}/ && mv $file src/${file%.*}/; done

# copy test project files
COPY tests/*/*.csproj ./
RUN for file in $(ls *.csproj); do mkdir -p tests/${file%.*}/ && mv $file tests/${file%.*}/; done

RUN dotnet restore 

# copy all source, build and test
COPY . .
RUN dotnet build -c Release --no-restore && dotnet test

# publish stage
FROM build AS publish
WORKDIR /source/src/Api
RUN dotnet publish -c Release --no-build -o /app

# final stage/image
FROM mcr.microsoft.com/dotnet/aspnet:6.0
WORKDIR /app
COPY --from=publish /app ./
# ensure we listen on any IP Address
ENV ASPNETCORE_URLS=http://*:5100
EXPOSE 5100

# health check
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD curl --fail --silent http://localhost:5100/health/liveness || exit 1

ENTRYPOINT ["dotnet", "Api.dll"]