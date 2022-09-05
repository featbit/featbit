from app.extensions import get_scheduler
from app.clickhouse.models import optimize_tables

scheduler = get_scheduler()


@scheduler.task(
    "interval",
    id="task_optimize_tables",
    seconds=300,
    max_instances=1
)
def task_optimize_tables():
    with scheduler.app.app_context():
        optimize_tables()
