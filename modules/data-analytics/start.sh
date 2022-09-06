#!/bin/bash
set -e

export FLASK_APP='flasky:app'

flask migrate-clickhouse

gunicorn 'flasky:app'