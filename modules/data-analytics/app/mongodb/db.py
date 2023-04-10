from flask import current_app
from pymongo import MongoClient
from app.extensions import get_mongodb
from app.setting import MONGO_DB, MONGO_URI


def get_db():
    try:
        pymongo = get_mongodb(current_app, MONGO_URI)
        pymongo.cx.server_info()
        db = pymongo.cx[MONGO_DB]
    except:
        pymongo = MongoClient(MONGO_URI)
        db = pymongo[MONGO_DB]
    return db
