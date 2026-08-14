#!/usr/bin/env bash

# FeatBit Kafka + ClickHouse deployment migration: 5.4.6 -> 6.0.0
# Migration 2: metrics and experimentation control-plane data.
#
# Kafka and ClickHouse do not contain metric definitions, experiments,
# iterations, or activities. This dispatcher runs the real Migration 2 against
# the API Server's configured main database. It intentionally performs no
# Kafka or ClickHouse writes.
#
# PostgreSQL:
#   FEATBIT_DB_PROVIDER=PostgreSQL \
#   FEATBIT_DATABASE_URL='postgresql://...' \
#   bash ./02-metrics-and-experimentation-migration.sh
#
# MongoDB:
#   FEATBIT_DB_PROVIDER=MongoDB \
#   FEATBIT_MONGODB_URI='mongodb://...' \
#   FEATBIT_MIGRATION_DATABASE=featbit \
#   bash ./02-metrics-and-experimentation-migration.sh

set -Eeuo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
provider="${FEATBIT_DB_PROVIDER:-}"

case "${provider,,}" in
    postgresql|postgres|pg)
        postgresql_url="${FEATBIT_DATABASE_URL:-${DATABASE_URL:-}}"
        postgresql_script="$script_dir/../postgresql/prompts/02-metrics-and-experimentation-migration.sql"
        psql_bin="${PSQL_BIN:-psql}"

        if [[ -z "$postgresql_url" ]]; then
            echo "FEATBIT_DATABASE_URL (or DATABASE_URL) is required for PostgreSQL" >&2
            exit 2
        fi
        if [[ ! -f "$postgresql_script" ]]; then
            echo "PostgreSQL Migration 2 script not found: $postgresql_script" >&2
            exit 2
        fi
        if ! command -v "$psql_bin" >/dev/null 2>&1; then
            echo "PostgreSQL client not found: $psql_bin" >&2
            exit 2
        fi

        echo "Running Metrics/Experimentation Migration 2 in PostgreSQL..."
        "$psql_bin" "$postgresql_url" --file "$postgresql_script"
        ;;

    mongodb|mongo)
        mongodb_uri="${FEATBIT_MONGODB_URI:-${MONGODB_URI:-}}"
        mongodb_script="$script_dir/../mongodb/02-metrics-and-experimentation-migration.js"
        mongosh_bin="${MONGOSH_BIN:-mongosh}"

        if [[ -z "$mongodb_uri" ]]; then
            echo "FEATBIT_MONGODB_URI (or MONGODB_URI) is required for MongoDB" >&2
            exit 2
        fi
        if [[ -z "${FEATBIT_MIGRATION_DATABASE:-}" ]]; then
            echo "FEATBIT_MIGRATION_DATABASE is required for MongoDB" >&2
            exit 2
        fi
        if [[ ! -f "$mongodb_script" ]]; then
            echo "MongoDB Migration 2 script not found: $mongodb_script" >&2
            exit 2
        fi
        if ! command -v "$mongosh_bin" >/dev/null 2>&1; then
            echo "MongoDB shell not found: $mongosh_bin" >&2
            exit 2
        fi

        echo "Running Metrics/Experimentation Migration 2 in MongoDB..."
        "$mongosh_bin" "$mongodb_uri" --file "$mongodb_script"
        ;;

    *)
        echo "FEATBIT_DB_PROVIDER must be PostgreSQL or MongoDB" >&2
        exit 2
        ;;
esac

echo "Metrics/Experimentation migration completed in the main database."
echo "No Kafka or ClickHouse control-plane records were created (by design)."
echo "Complete the cross-database key checks in 02-metrics-and-experimentation-migration.md after Events Migration 1."
