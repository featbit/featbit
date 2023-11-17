## Introduction

This directory contains these compose files for development purposes, including

- [docker-compose-dev.yml](docker-compose-dev.yml): FeatBit Standard, images will be built from code directly
- [docker-compose-pro-dev.yml](docker-compose-pro-dev.yml): FeatBit Professional, images will be built from code
  directly
- [docker-compose-infra.yml](docker-compose-infra.yml): FeatBit infrastructures
- [docker-compose-services.yml](docker-compose-services.yml): FeatBit Core Services
- [docker-compose-clickhouse.yml](docker-compose-clickhouse.yml): Clickhouse for FeatBit

> **Note**
> You should run these compose files from the root directory and include the --project-diretory argument, for
> example: `docker compose --project-directory . -f ./docker/composes/docker-compose-dev.yml up --build -d`

### SSO Setup

```bash
docker compose --project-directory . -f ./docker/composes/docker-compose-dev.yml up -d
docker run -d -p 9000:8080 -e KEYCLOAK_ADMIN=admin -e KEYCLOAK_ADMIN_PASSWORD=admin --name=keycloak quay.io/keycloak/keycloak:22.0.1 start-dev
```

1. Create a realm named `featbit`
2. Create a OIDC client
3. Set the client's `Valid Redirect URIs` to `http://localhost:8081/*`
4. Set the client's `Web Origins` to `http://localhost:8081/*`
5. Enable **Client authentication**
6. Create a user
7. Set environment variable `SSOEnabled` to `true`
8. Add the following OpenId Connect settings via UI (replace with your own values)

  ```json
  {
    "clientId": "test-oidc-client",
    "clientSecret": "tr8XwUrWo8U2wdJFb7EZ5HbqVWZEns5V",
    "tokenEndpoint": "http://host.docker.internal:9000/realms/featbit/protocol/openid-connect/token",
    "clientAuthenticationMethod": "client_secret_post",
    "authorizationEndpoint": "http://localhost:9000/realms/featbit/protocol/openid-connect/auth",
    "userEmailClaim": "email",
    "scope": "openid profile email"
  }
  ```