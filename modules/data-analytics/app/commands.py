import click
from flask.cli import with_appcontext

from app.clickhouse.commands import migrate as migrate_ch
from app.mongodb.commands import migrate as migrate_mongo


@click.command()
@click.option("--upto",
              default=9999,
              help="Database state will be brought to the state after that migration.")
@click.option("--check",
              is_flag=True,
              help="Exits with a non-zero status if unapplied migrations exist.")
@click.option("--plan",
              is_flag=True,
              help="Shows a list of the migration actions that will be performed.")
@click.option("--print-sql",
              is_flag=True,
              help="Use with --plan or --check. Also prints SQL for each migration to be applied.")
@with_appcontext
def migrate_clickhouse(upto, check, plan, print_sql):
    return migrate_ch(upto, check, plan, print_sql)


@click.command()
@with_appcontext
def migrate_mongodb():
    migrate_mongo()
