class Config:
    pass


class DevelopmentConfig(Config):
    ENV = 'development'
    DEBUG = True
    TESTING = True
    JSONIFY_PRETTYPRINT_REGULAR = True


class ProductionConfig(Config):
    pass


MangoDbProvider = "MongoDb"
PostgresDbProvider = "Postgres"