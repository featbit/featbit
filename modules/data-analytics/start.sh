#!/bin/bash
set -e

export FLASK_APP='flasky:app'

flask migrate-database

opentelemetry-instrument gunicorn 'flasky:app'
