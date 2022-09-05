
from flask import Blueprint

__blueprint = None


def get_expt_blueprint() -> Blueprint:
    global __blueprint
    if not __blueprint:
        __blueprint = Blueprint('expt', __name__)
    from app.experimentation import views
    return __blueprint
