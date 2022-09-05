import socket
from logging.config import dictConfig

from flask import Flask

from app.config import DevelopmentConfig, ProductionConfig
from app.extensions import get_scheduler
from app.setting import DEFAULT_LOGGING_CONFIG, WSGI

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

    if WSGI:
        _init_aps_scheduler(__app)

    from app.commands import migrate_clickhouse
    __app.cli.add_command(migrate_clickhouse, name='migrate-clickhouse')

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
    return __app
