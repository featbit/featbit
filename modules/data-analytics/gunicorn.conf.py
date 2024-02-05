import os
import logging

from opentelemetry import metrics, trace, _logs
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc._log_exporter import OTLPLogExporter
from opentelemetry._logs import LoggerProvider
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.instrumentation.logging import LoggingInstrumentor


bind = '0.0.0.0:10000'

workers = 2
worker_class = 'gthread'
threads = 4
worker_tmp_dir = os.getenv('GUNICORN_WORKER_TMP_DIR', '/tmp')

otel_endpoint = os.getenv('OTEL_EXPORTER_OTLP_ENDPOINT', 'http://otel-collector:4318')
otel_service_name = os.getenv('OTEL_SERVICE_NAME', 'featbit-das')
otel_python_log_level = os.getenv('OTEL_PYTHON_LOG_LEVEL', 'info')
otel_log_format = os.getenv('OTEL_PYTHON_LOG_FORMAT', '%(msg)s [span_id=%(span_id)s]')

limit_request_line = 0
limit_request_field_size = 0
limit_request_fields = 1000

loglevel = otel_python_log_level
errorlog = '-'
accesslog = "-"
access_log_format = (
    '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'
)

raw_env = ['WSGI=y']

LoggingInstrumentor().instrument(set_logging_format=True)

logging.basicConfig()

def post_fork(server, worker):
    if os.getenv('ENABLE_OPENTELEMETRY', 'false').lower() != 'true':
        return

    server.log.info("Worker spawned (pid: %s)", worker.pid)
    
    resource = Resource.create(
        attributes={
            "service.name": otel_service_name,
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

    # traces
    trace.set_tracer_provider(TracerProvider(resource=resource))
    
    # This uses insecure connection for the purpose of example. Please see the
    # OTLP Exporter documentation for other options.
    span_processor = BatchSpanProcessor(
        OTLPSpanExporter(endpoint=otel_endpoint, insecure=True)
    )
    trace.get_tracer_provider().add_span_processor(span_processor)

    # metrics
    reader = PeriodicExportingMetricReader(
        OTLPMetricExporter(endpoint=otel_endpoint, insecure=True)
    )
    metrics.set_meter_provider(
        MeterProvider(
            resource=resource,
            metric_readers=[reader],
        )
    )

    # logs
    logging_provider = LoggerProvider(resource=resource)
    _logs.set_logger_provider(logging_provider)
    log_processor = BatchLogRecordProcessor(
        OTLPLogExporter(endpoint=otel_endpoint, insecure=True)
    )
    _logs.get_logger_provider().add_log_record_processor(log_processor)
    handler = LoggingHandler(level=logging.DEBUG, logger_provider=logging_provider)
    logging.getLogger('gunicorn.error').addHandler(handler)