from flask_apscheduler import APScheduler
from flask_caching import Cache

__scheduler = None

__cache = None


def get_scheduler():
    global __scheduler
    if __scheduler is None:
        __scheduler = APScheduler()
    return __scheduler


def get_cache(config={}):
    global __cache
    if __cache is None:
        __cache = Cache(config=config)
    return __cache
