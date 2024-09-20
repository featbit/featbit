import os

bind = '0.0.0.0:10000'
wsgi_app = 'flasky:app'

# workers and threads
workers = 2
worker_class = 'gthread'
threads = 4
worker_tmp_dir = os.getenv('GUNICORN_WORKER_TMP_DIR', '/tmp')

# request settings
limit_request_line = 0
limit_request_field_size = 0
limit_request_fields = 1000
timeout = 120

# logging
accesslog = "-"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'
errorlog = '-'
loglevel = 'info'

raw_env = ['WSGI=y']

# NOTE: OTel does not work well with `gunicorn` preloading the app, if this is crucial,
# consider using `preload_app = True` + [application factory](https://docs.gunicorn.org/en/stable/run.html)
preload_app = False