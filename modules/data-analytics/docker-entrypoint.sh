#!/bin/sh

# Abort on any error (including if wait-for-it fails).
set -e

if [ "$LIGHT_VERSION" == "true" ]; then
    # Wait for the backend to be up, if we know where it is.
    ./wait-for-it.sh "${MONGO_HOST}:27017 --timeout=300 --strict" 
else
    # Wait for the backend to be up, if we know where it is.
    ./wait-for-it.sh "${CLICKHOUSE_HOST}:8123 --timeout=300 --strict" 
fi


# Run the main container command.
exec "$@"