# build stage
# https://hub.docker.com/_/microsoft-dotnet
FROM mcr.microsoft.com/dotnet/sdk:6.0 AS build
WORKDIR /source

# copy csproj and restore as distinct layers
COPY *.sln .
COPY src/Domain/*.csproj src/Domain/
COPY src/Application/*.csproj src/Application/
COPY src/Infrastructure/*.csproj src/Infrastructure/
COPY src/Api/*.csproj src/Api/
COPY tests/Domain.UnitTests/*.csproj tests/Domain.UnitTests/
COPY tests/Application.UnitTests/*.csproj tests/Application.UnitTests/
COPY tests/Application.IntegrationTests/*.csproj tests/Application.IntegrationTests/
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
ENV ASPNETCORE_URLS=http://*:5000
EXPOSE 5000
ENTRYPOINT ["dotnet", "Api.dll"]