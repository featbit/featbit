#!/usr/bin/env bash

# FeatBit Kafka + ClickHouse migration: 5.4.6 -> 6.0.0
#
# This runner coordinates the safe Kafka offset boundary around the ClickHouse
# backfill in 01-events-migration.sql. Stop new insight production and stop the
# old DAS/Kafka consumer before running it. The runner then:
#   1. requires every old-group partition to have lag 0;
#   2. exports the old group's exact committed offsets;
#   3. runs the ClickHouse historical backfill;
#   4. initializes the inactive v6 consumer group at those exact offsets.
#
# Required environment:
#   KAFKA_BOOTSTRAP_SERVERS   for example kafka:9092
#
# Common optional environment:
#   KAFKA_OLD_GROUP           default: ch_group
#   KAFKA_NEW_GROUP           default: featbit_clickhouse_release_decision
#   KAFKA_TOPIC               default: featbit-insights
#   KAFKA_COMMAND_CONFIG      Kafka client properties file
#   CLICKHOUSE_HOST           default: localhost
#   CLICKHOUSE_PORT           default: 9000
#   CLICKHOUSE_USER           default: default
#   CLICKHOUSE_PASSWORD       omitted by default
#   CLICKHOUSE_SECURE         set to 1 to pass --secure
#   FEATBIT_MIGRATION_STATE_DIR  default: ./featbit-migration-state

set -Eeuo pipefail

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
clickhouse_sql="$script_dir/01-events-migration.sql"

kafka_bootstrap_servers="${KAFKA_BOOTSTRAP_SERVERS:-}"
kafka_topic="${KAFKA_TOPIC:-featbit-insights}"
kafka_old_group="${KAFKA_OLD_GROUP:-ch_group}"
kafka_new_group="${KAFKA_NEW_GROUP:-featbit_clickhouse_release_decision}"
kafka_groups_bin="${KAFKA_CONSUMER_GROUPS_BIN:-kafka-consumer-groups.sh}"

clickhouse_client_bin="${CLICKHOUSE_CLIENT_BIN:-clickhouse-client}"
clickhouse_host="${CLICKHOUSE_HOST:-localhost}"
clickhouse_port="${CLICKHOUSE_PORT:-9000}"
clickhouse_user="${CLICKHOUSE_USER:-default}"

if [[ -z "$kafka_bootstrap_servers" ]]; then
    echo "KAFKA_BOOTSTRAP_SERVERS is required" >&2
    exit 2
fi
if [[ "$kafka_old_group" == "$kafka_new_group" ]]; then
    echo "KAFKA_OLD_GROUP and KAFKA_NEW_GROUP must be different" >&2
    exit 2
fi
if [[ ! -f "$clickhouse_sql" ]]; then
    echo "ClickHouse migration SQL not found: $clickhouse_sql" >&2
    exit 2
fi
if ! command -v "$kafka_groups_bin" >/dev/null 2>&1; then
    echo "Kafka consumer-groups CLI not found: $kafka_groups_bin" >&2
    exit 2
fi
if ! command -v "$clickhouse_client_bin" >/dev/null 2>&1; then
    echo "ClickHouse client not found: $clickhouse_client_bin" >&2
    exit 2
fi

kafka_args=(--bootstrap-server "$kafka_bootstrap_servers")
if [[ -n "${KAFKA_COMMAND_CONFIG:-}" ]]; then
    if [[ ! -f "$KAFKA_COMMAND_CONFIG" ]]; then
        echo "KAFKA_COMMAND_CONFIG does not exist: $KAFKA_COMMAND_CONFIG" >&2
        exit 2
    fi
    kafka_args+=(--command-config "$KAFKA_COMMAND_CONFIG")
fi

clickhouse_args=(
    --host "$clickhouse_host"
    --port "$clickhouse_port"
    --user "$clickhouse_user"
)
if [[ -n "${CLICKHOUSE_PASSWORD:-}" ]]; then
    clickhouse_args+=(--password "$CLICKHOUSE_PASSWORD")
fi
if [[ "${CLICKHOUSE_SECURE:-0}" == "1" ]]; then
    clickhouse_args+=(--secure)
fi
if [[ -n "${CLICKHOUSE_CLIENT_CONFIG:-}" ]]; then
    if [[ ! -f "$CLICKHOUSE_CLIENT_CONFIG" ]]; then
        echo "CLICKHOUSE_CLIENT_CONFIG does not exist: $CLICKHOUSE_CLIENT_CONFIG" >&2
        exit 2
    fi
    clickhouse_args+=(--config-file "$CLICKHOUSE_CLIENT_CONFIG")
fi

state_root="${FEATBIT_MIGRATION_STATE_DIR:-$PWD/featbit-migration-state}"
mkdir -p -- "$state_root"
state_dir="$(mktemp -d "$state_root/events-XXXXXX")"
old_group_description="$state_dir/old-group-before.txt"
old_group_offsets="$state_dir/cutover-offsets.csv"
offset_export_errors="$state_dir/cutover-offsets.stderr.txt"
clickhouse_report="$state_dir/clickhouse-migration-report.txt"
new_group_description="$state_dir/new-group-after.txt"
new_group_offsets="$state_dir/new-group-offsets.csv"

echo "Migration evidence directory: $state_dir"
echo "Checking old Kafka consumer group lag..."
"$kafka_groups_bin" "${kafka_args[@]}" \
    --describe --group "$kafka_old_group" 2>&1 | tee "$old_group_description"

if ! awk -v topic="$kafka_topic" '
    $2 == topic {
        partitions += 1
        if ($6 !~ /^[0-9]+$/ || $6 != 0) bad = 1
    }
    END {
        if (partitions == 0 || bad) exit 1
    }
' "$old_group_description"; then
    echo "Migration stopped: old group has missing/non-zero lag for $kafka_topic" >&2
    exit 1
fi

echo "Exporting the exact committed offsets from inactive group $kafka_old_group..."
if ! "$kafka_groups_bin" "${kafka_args[@]}" \
    --group "$kafka_old_group" \
    --topic "$kafka_topic" \
    --reset-offsets --to-current --dry-run --export \
    >"$old_group_offsets" 2>"$offset_export_errors"; then
    echo "Migration stopped: old group must be inactive before offsets can be exported" >&2
    cat "$offset_export_errors" >&2
    exit 1
fi

if ! awk -F',' -v topic="$kafka_topic" '
    $1 == topic && $2 ~ /^[0-9]+$/ && $3 ~ /^[0-9]+$/ { partitions += 1; next }
    NF > 0 { bad = 1 }
    END { if (partitions == 0 || bad) exit 1 }
' "$old_group_offsets"; then
    echo "Migration stopped: Kafka offset export is empty or malformed" >&2
    exit 1
fi

echo "Running ClickHouse historical event backfill..."
"$clickhouse_client_bin" "${clickhouse_args[@]}" \
    --multiquery --queries-file "$clickhouse_sql" | tee "$clickhouse_report"

echo "Setting inactive v6 group $kafka_new_group to the saved cutover offsets..."
"$kafka_groups_bin" "${kafka_args[@]}" \
    --group "$kafka_new_group" \
    --reset-offsets --from-file "$old_group_offsets" --execute

"$kafka_groups_bin" "${kafka_args[@]}" \
    --describe --group "$kafka_new_group" 2>&1 | tee "$new_group_description"

"$kafka_groups_bin" "${kafka_args[@]}" \
    --group "$kafka_new_group" \
    --topic "$kafka_topic" \
    --reset-offsets --to-current --dry-run --export \
    >"$new_group_offsets"

if ! diff -u \
    <(LC_ALL=C sort "$old_group_offsets") \
    <(LC_ALL=C sort "$new_group_offsets"); then
    echo "Migration stopped: v6 group offsets do not match the saved cutover offsets" >&2
    exit 1
fi

echo "Kafka offset cutover and ClickHouse backfill completed."
echo "Evidence: $state_dir"
echo "Next: create/attach the v6 Kafka engine table and its two materialized views, then start v6 services."
