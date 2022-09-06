import json
from enum import Enum
from typing import Any, Callable, Dict, Iterable, Optional, Union

from app.clickhouse.client import sync_execute
from app.setting import (KAFKA_HOSTS, KAFKA_PRODUCER_ENABLED,
                         KAFKA_PRODUCER_RETRIES, KAFKA_SASL_MECHANISM,
                         KAFKA_SASL_PASSWORD, KAFKA_SASL_USER,
                         KAFKA_SECURITY_PROTOCOL)
from utils import SingletonDecorator

from kafka import KafkaProducer as KP


class _KafkaSecurityProtocol(str, Enum):
    PLAINTEXT = "PLAINTEXT"
    SSL = "SSL"
    SASL_PLAINTEXT = "SASL_PLAINTEXT"
    SASL_SSL = "SASL_SSL"


def _sasl_params():
    if KAFKA_SECURITY_PROTOCOL in [_KafkaSecurityProtocol.SASL_PLAINTEXT, _KafkaSecurityProtocol.SASL_SSL]:
        return {
            "sasl_mechanism": KAFKA_SASL_MECHANISM,
            "sasl_plain_username": KAFKA_SASL_USER,
            "sasl_plain_password": KAFKA_SASL_PASSWORD,
        }
    return {}


class _KafkaProducer:
    def __init__(self):
        self.producer = KP(
            retries=KAFKA_PRODUCER_RETRIES,
            bootstrap_servers=KAFKA_HOSTS,
            security_protocol=KAFKA_SECURITY_PROTOCOL or _KafkaSecurityProtocol.PLAINTEXT,
            **_sasl_params())

    @staticmethod
    def json_serializer(d):
        b = json.dumps(d).encode("utf-8")
        return b

    def produce(self, topic: str, data: Any, key: str = None, value_serializer: Optional[Callable[[Any], Any]] = None):
        if not value_serializer:
            value_serializer = self.json_serializer
        b = value_serializer(data)
        if key is not None:
            key = key.encode("utf-8")
        self.producer.send(topic, value=b, key=key)

    def flush(self):
        self.producer.flush()


KafkaProducer = SingletonDecorator(_KafkaProducer)


class ClickhouseProducer:

    def __init__(self):
        self.producer = KafkaProducer() if KAFKA_PRODUCER_ENABLED else None

    def produce(self,
                sql: str,
                topic: str,
                data: Union[Iterable[Dict[str, Any]], Dict[str, Any]],
                params: Union[Iterable[Dict[str, Any]], Dict[str, Any]]):
        if self.producer is not None:
            if isinstance(data, Iterable):
                for element in data:
                    self.producer.produce(topic=topic, data=element)
            else:
                self.producer.produce(topic=topic, data=data)
        else:
            sync_execute(sql, args=params)
