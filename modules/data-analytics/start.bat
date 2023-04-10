@echo on

set FLASK_APP='flasky:app'

flask migrate-database

flask run