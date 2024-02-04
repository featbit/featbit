import socket
from logging.config import dictConfig
from typing import List, Tuple

from flask import Flask

from app.config import DevelopmentConfig, ProductionConfig
from app.extensions import get_cache, get_mongodb, get_scheduler
from app.setting import (CACHE_KEY_PREFIX, CACHE_TYPE, DEFAULT_LOGGING_CONFIG,
                         IS_PRO, MONGO_URI, REDIS_CLUSTER_HOST_PORT_PAIRS,
                         REDIS_DB, REDIS_HOST, REDIS_PASSWORD, REDIS_PORT,
                         REDIS_SENTINEL_HOST_PORT_PAIRS,
                         REDIS_SENTINEL_MASTER_SET, REDIS_SENTINEL_PASSWORD,
                         REDIS_SSL, REDIS_USER, WSGI)

CONFIGS = {
    'production': ProductionConfig,
    'development': DevelopmentConfig,
    'default': ProductionConfig
}

__app = None


def _create_app(config_name='default') -> Flask:
    global __app

    dictConfig(DEFAULT_LOGGING_CONFIG)

    __app = Flask(__name__)
    __app.config.from_object(CONFIGS[config_name])

    from app.main import get_main_blueprint
    __app.register_blueprint(get_main_blueprint(), url_prefix='/api')

    from app.experimentation import get_expt_blueprint
    __app.register_blueprint(get_expt_blueprint(), url_prefix='/api/expt')

    from app.health import get_health_blueprint
    __app.register_blueprint(get_health_blueprint(), url_prefix='/health')

    # https://flask-caching.readthedocs.io/en/latest/
    cache_config = {"CACHE_KEY_PREFIX": CACHE_KEY_PREFIX}
    cache_options = {"ssl": REDIS_SSL, "username": REDIS_USER}
    if CACHE_TYPE == "RedisClusterCache":
        cache_config.update({"CACHE_TYPE": "RedisClusterCache",
                             "CACHE_REDIS_PASSWORD": REDIS_PASSWORD,
                             "CACHE_REDIS_CLUSTER": REDIS_CLUSTER_HOST_PORT_PAIRS,
                             "CACHE_OPTIONS": cache_options, })  # type: ignore

    elif CACHE_TYPE == "RedisSentinelCache":
        cache_config.update({"CACHE_TYPE": "RedisSentinelCache",
                             "CACHE_REDIS_PASSWORD": REDIS_PASSWORD,
                             "CACHE_REDIS_DB": REDIS_DB,
                             "CACHE_REDIS_SENTINELS": _parse_redis_sentinel_hosts(REDIS_SENTINEL_HOST_PORT_PAIRS),
                             "CACHE_REDIS_SENTINEL_PASSWORD": REDIS_SENTINEL_PASSWORD,
                             "CACHE_REDIS_SENTINEL_MASTER": REDIS_SENTINEL_MASTER_SET,
                             "CACHE_OPTIONS": cache_options, })  # type: ignore
    else:
        cache_config.update({"CACHE_TYPE": "RedisCache",
                             "CACHE_KEY_PREFIX": CACHE_KEY_PREFIX,
                             "CACHE_REDIS_HOST": REDIS_HOST,
                             "CACHE_REDIS_PORT": REDIS_PORT,
                             "CACHE_REDIS_DB": REDIS_DB,
                             "CACHE_REDIS_PASSWORD": REDIS_PASSWORD,
                             "CACHE_OPTIONS": cache_options, })  # type: ignore
    cache = get_cache(config=cache_config)
    cache.init_app(__app)

    if IS_PRO:
        if WSGI:
            _init_aps_scheduler(__app)
        from app.commands import migrate_clickhouse
        __app.cli.add_command(migrate_clickhouse, name='migrate-database')
    else:
        get_mongodb(__app, MONGO_URI)
        from app.commands import migrate_mongodb
        __app.cli.add_command(migrate_mongodb, name='migrate-database')

    return __app


# https://stackoverflow.com/questions/16053364/make-sure-only-one-worker-launches-the-apscheduler-event-in-a-pyramid-web-app-ru
def _init_aps_scheduler(flask: Flask) -> None:
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.bind(('127.0.0.1', 47200))
    except socket.error:
        flask.logger.info("scheduler already started")
    else:
        scheduler = get_scheduler()
        scheduler.init_app(flask)
        from app import tasks
        scheduler.start()


def get_app(config_name='default') -> Flask:
    if __app is None:
        _create_app(config_name)
    return __app  # type: ignore


def _parse_redis_sentinel_hosts(hosts: str) -> List[Tuple]:
    try:
        if hosts and hosts.strip():
            nodes = [(node.split(":")) for node in hosts.split(",")]
            return [(node[0].strip(), int(node[1].strip())) for node in nodes]
        return [("127.0.0.1", 26379)]
    except:
        return [("127.0.0.1", 26379)]
