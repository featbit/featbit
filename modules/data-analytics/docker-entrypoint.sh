#!/bin/sh

# Abort on any error (including if wait-for-it fails).
set -e

if [ "$CHECK_DB_LIVNESS" = true ]; then
  if [ "$DB_PROVIDER" = "MongoDb" ]; then
    ./wait-for-it.sh "${MONGO_HOST}:${MONGO_PORT} --timeout=300 --strict"
  elif [ "$DB_PROVIDER" = "Postgres" ]; then
    ./wait-for-it.sh "${POSTGRES_HOST}:${POSTGRES_PORT} --timeout=300 --strict"
  else
    ./wait-for-it.sh "${CLICKHOUSE_HOST}:${CLICKHOUSE_PORT} --timeout=300 --strict"
  fi
fi

# Run the main container command.
exec "$@"
