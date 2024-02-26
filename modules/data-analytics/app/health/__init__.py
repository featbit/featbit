
from flask import Blueprint

__blueprint = None


def get_health_blueprint() -> Blueprint:
    global __blueprint
    if not __blueprint:
        __blueprint = Blueprint('health', __name__)
    from app.health import views
    return __blueprint
