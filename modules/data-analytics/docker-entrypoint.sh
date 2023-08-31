#!/bin/sh

# Abort on any error (including if wait-for-it fails).
set -e

if [ "$CHECK_DB_LIVNESS" = true ]; then
    if [ "$IS_PRO" = false ]; then
        ./wait-for-it.sh "${MONGO_HOST}:${MONGO_PORT} --timeout=300 --strict" 
    else
        ./wait-for-it.sh "${CLICKHOUSE_HOST}:8123 --timeout=300 --strict" 
    fi
fi

# Run the main container command.
exec "$@"
