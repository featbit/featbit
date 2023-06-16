import hashlib
import os
from datetime import date, datetime
from typing import Any, Callable, Optional, Union
from uuid import UUID

import numpy as np
import pytz
from dateutil.parser import isoparse
from flask import jsonify


def str_to_bool(value: Any) -> bool:
    if not value:
        return False
    return str(value).lower() in ("y", "yes", "t", "true", "on", "1")


def is_valid_uuid(uuid_to_test, version=4):

    try:
        uuid_obj = UUID(uuid_to_test, version=version)
    except ValueError:
        return False
    return str(uuid_obj) == uuid_to_test


def get_from_env(key: str, default: Any = None, *, type_cast: Optional[Callable[[Any], Any]] = None) -> Any:
    value = os.getenv(key)
    if value is None or value == "":
        return default
    if type_cast is not None:
        return type_cast(value)
    return value


def internal_error_handler(e: Exception):
    return jsonify(code=500, error=str(e), data={}), 500


class SingletonDecorator:
    def __init__(self, klass):
        self.klass = klass
        self.instance = None

    def __call__(self, *args, **kwds):
        if self.instance is None:
            self.instance = self.klass(*args, **kwds)
        return self.instance


def format_float_positional(value: Optional[float]) -> Optional[str]:
    return np.format_float_positional(value, precision=10, trim='-') if value is not None else None


def time_to_special_tz(source: Union[datetime, date], tz: str) -> datetime:
    if isinstance(source, datetime):
        return source.astimezone(pytz.timezone(tz)) if source.tzinfo else pytz.timezone(tz).localize(source)
    elif isinstance(source, date):
        return pytz.timezone(tz).localize(datetime.combine(source, datetime.min.time()))
    else:
        raise ValueError("source is neithor datetime nor date")


def to_md5_hexdigest(value: bytes) -> str:
    return hashlib.md5(value).hexdigest()


def to_UTC_datetime(value: Union[int, float, str, datetime]) -> datetime:
    def len_int(value):
        return len(str(round(value)))

    if isinstance(value, datetime):
        dt = value
    elif isinstance(value, str) and not value.isnumeric():
        dt = isoparse(value)
    else:
        # https://stackoverflow.com/questions/23929145/how-to-test-if-a-given-time-stamp-is-in-seconds-or-milliseconds
        value = float(value)
        n = len_int(value)
        if n > 13:
            dt = datetime.utcfromtimestamp(value / 1000000)
        elif n > 10:
            dt = datetime.utcfromtimestamp(value / 1000)
        else:
            dt = datetime.utcfromtimestamp(value)
    return time_to_special_tz(dt, 'UTC')


def dt_to_seconds_or_millis_or_micros(value: datetime, timespec="milliseconds") -> int:
    if timespec == "milliseconds":
        return round(value.timestamp() * 1000)
    elif timespec == "microseconds":
        return round(value.timestamp() * 1000000)
    else:
        return round(value.timestamp())
