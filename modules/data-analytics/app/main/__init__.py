
from flask import Blueprint

__blueprint = None


def get_main_blueprint() -> Blueprint:
    global __blueprint
    if not __blueprint:
        __blueprint = Blueprint('main', __name__)
    from app.main import views
    return __blueprint
