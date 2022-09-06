#!/bin/sh

# Abort on any error (including if wait-for-it fails).
set -e

# Wait for the backend to be up, if we know where it is.
./wait-for-it.sh "${CLICKHOUSE_HOST}:8123 --timeout=300 --strict" 


# Run the main container command.
exec "$@"