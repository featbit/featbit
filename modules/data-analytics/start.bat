@echo on

set FLASK_APP='flasky:app'

flask migrate-clickhouse

flask run