from flask_apscheduler import APScheduler

__scheduler = None


def get_scheduler():
    global __scheduler
    if __scheduler is None:
        __scheduler = APScheduler()
    return __scheduler
