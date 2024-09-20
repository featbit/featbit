import logging
import os

from opentelemetry import metrics, trace
from opentelemetry._logs import set_logger_provider
from opentelemetry.exporter.otlp.proto.grpc._log_exporter import \
    OTLPLogExporter
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import \
    OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import \
    OTLPSpanExporter
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

from app.setting import ENABLE_OPENTELEMETRY

bind = '0.0.0.0:10000'
wsgi_app = 'flasky:app'

# workers and threads
workers = 2
worker_class = 'gthread'
threads = 4
worker_tmp_dir = os.getenv('GUNICORN_WORKER_TMP_DIR', '/tmp')

# request settings
limit_request_line = 0
limit_request_field_size = 0
limit_request_fields = 1000

# logging
accesslog = "-"
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'
errorlog = '-'
loglevel = 'info'

raw_env = ['WSGI=y']


def post_fork(server, worker):
    if not ENABLE_OPENTELEMETRY:
        return
    resource = Resource.create(
        attributes={
            # If workers are not distinguished within attributes, traces and
            # metrics exported from each worker will be indistinguishable. While
            # not necessarily an issue for traces, it is confusing for almost
            # all metric types. A built-in way to identify a worker is by PID
            # but this may lead to high label cardinality. An alternative
            # workaround and additional discussion are available here:
            # https://github.com/benoitc/gunicorn/issues/1352
            "worker": worker.pid,
        }
    )
    # Sets the global default tracer provider
    provider = TracerProvider(resource=resource)
    span_processor = BatchSpanProcessor(OTLPSpanExporter())
    provider.add_span_processor(span_processor)
    trace.set_tracer_provider(provider)

    # Sets the global default metric provider
    reader = PeriodicExportingMetricReader(OTLPMetricExporter())
    metrics.set_meter_provider(MeterProvider(resource=resource, metric_readers=[reader]))

    # Attach OTLP handler to root logger
    logger_provider = LoggerProvider(resource=resource)
    exporter = OTLPLogExporter()
    logger_provider.add_log_record_processor(BatchLogRecordProcessor(exporter))
    set_logger_provider(logger_provider)
    handler = LoggingHandler(level=logging.getLevelName(loglevel.upper()), logger_provider=logger_provider)
    logging.getLogger('gunicorn.error').addHandler(handler)
