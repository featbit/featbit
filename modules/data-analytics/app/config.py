class Config:
    pass


class DevelopmentConfig(Config):
    ENV = 'development'
    DEBUG = True
    TESTING = True
    JSONIFY_PRETTYPRINT_REGULAR = True


class ProductionConfig(Config):
    pass


MongoDbProvider = "MongoDb"
PostgresDbProvider = "Postgres"
ClickHouseDbProvider = "ClickHouse"