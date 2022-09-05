import os


bind = '0.0.0.0:5000'

workers = 2
worker_class = 'gthread'
threads = 4
worker_tmp_dir = os.getenv('GUNICORN_WORKER_TMP_DIR', '/tmp')

limit_request_line = 0
limit_request_field_size = 0
limit_request_fields = 1000

loglevel = 'info'
errorlog = '-'

raw_env = ['WSGI=y']
