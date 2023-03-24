from flask_apscheduler import APScheduler
from flask_caching import Cache

from flask_pymongo import PyMongo

__scheduler = None

__cache = None

__mongodb = None


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


def get_mongodb(app=None, uri=None):
    global __mongodb
    if __mongodb is None and app is not None and uri is not None:
        __mongodb = PyMongo(app, uri=uri)
    return __mongodb
