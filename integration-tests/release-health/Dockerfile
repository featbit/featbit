FROM mcr.microsoft.com/dotnet/sdk:10.0.201 AS build
ARG PROJECT=Demo.Api
WORKDIR /src
COPY . .
RUN dotnet publish ${PROJECT}/${PROJECT}.csproj -c Release -o /app
FROM mcr.microsoft.com/dotnet/aspnet:10.0.5
ARG PROJECT=Demo.Api
ENV APP_DLL=${PROJECT}.dll
ENV ASPNETCORE_URLS=http://+:8080
WORKDIR /app
COPY --from=build /app .
USER $APP_UID
ENTRYPOINT ["sh", "-c", "exec dotnet \"$APP_DLL\""]
