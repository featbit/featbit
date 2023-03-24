#!/bin/bash
set -e

export FLASK_APP='flasky:app'

flask migrate-database

gunicorn 'flasky:app'