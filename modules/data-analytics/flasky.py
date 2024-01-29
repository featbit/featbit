
import os
import logging

from dotenv import load_dotenv
load_dotenv()

if os.getenv('FLASK_APP', None):
    from app import get_app
    app = get_app(os.getenv('FLASK_CONFIG', 'default'))
    gunicorn_logger = logging.getLogger('gunicorn.error')
    app.logger.handlers = gunicorn_logger.handlers
    app.logger.setLevel(gunicorn_logger.level)

if __name__ == '__main__':
    if app is not None:
        app.run(port=10000)
