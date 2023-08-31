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
> example: `docker compose --project-directory . -f ./docker/composes/docker-compose-dev.yml up -d`