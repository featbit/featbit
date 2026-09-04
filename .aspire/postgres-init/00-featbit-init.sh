#!/usr/bin/env bash
set -Eeuo pipefail

for migration in /featbit-init/released/*.sql; do
    echo "Applying released FeatBit migration: ${migration}"
    psql -v ON_ERROR_STOP=1 \
        --username "${POSTGRES_USER}" \
        --dbname "${POSTGRES_DB:-postgres}" \
        --file "${migration}"
done

echo "Applying pending FeatBit migration: /featbit-init/pending/vNext.sql"
psql -v ON_ERROR_STOP=1 \
    --username "${POSTGRES_USER}" \
    --dbname "${POSTGRES_DB:-postgres}" \
    --file /featbit-init/pending/vNext.sql
