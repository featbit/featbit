#!/usr/bin/python

# Copyright The OpenTelemetry Authors
# SPDX-License-Identifier: Apache-2.0

# ---------------------------------------------------------------------------
# FeatBit-instrumented variant of the OpenTelemetry Demo recommendation
# service. Differences from upstream (otel-demo 2.2.0):
#   * The flagd / OpenFeature integration is replaced with FeatBit's native
#     Python server SDK (see featbit_client.py).
#   * Three realistic feature flags drive behavior, each with a safe default:
#       - recommendation-caching-enabled  (ops/kill-switch, bool)
#       - recommendation-list-max-results (config, number)
#       - recommendation-ranking-strategy (experiment, string)
#   * flag-not-found / eval-server-down are non-breaking (defaults are served).
#     A *misconfigured* value (negative max-results, unknown strategy) is passed
#     through to surface application resiliency gaps.
# ---------------------------------------------------------------------------

# Python
import os
import random
from concurrent import futures

# Pip
import grpc
from opentelemetry import trace, metrics
from opentelemetry._logs import set_logger_provider
from opentelemetry.exporter.otlp.proto.grpc._log_exporter import (
    OTLPLogExporter,
)
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.sdk.resources import Resource

# Local
import logging
import demo_pb2
import demo_pb2_grpc
import featbit_client
from grpc_health.v1 import health_pb2
from grpc_health.v1 import health_pb2_grpc

from metrics import (
    init_metrics
)

cached_ids = []


class RecommendationService(demo_pb2_grpc.RecommendationServiceServicer):
    def ListRecommendations(self, request, context):
        prod_list = get_product_list(request.product_ids)
        span = trace.get_current_span()
        span.set_attribute("app.products_recommended.count", len(prod_list))
        logger.info(f"Receive ListRecommendations for product ids:{prod_list}")

        # build and return response
        response = demo_pb2.ListRecommendationsResponse()
        response.product_ids.extend(prod_list)

        # Collect metrics for this service
        rec_svc_metrics["app_recommendations_counter"].add(len(prod_list), {'recommendation.type': 'catalog'})

        return response

    def Check(self, request, context):
        return health_pb2.HealthCheckResponse(
            status=health_pb2.HealthCheckResponse.SERVING)

    def Watch(self, request, context):
        return health_pb2.HealthCheckResponse(
            status=health_pb2.HealthCheckResponse.UNIMPLEMENTED)


def _rank_products(products, num_return, strategy):
    """Select `num_return` products using the experiment's ranking strategy.

    Dispatch by variant. An unrecognized variant raises (KeyError) rather than
    silently falling back — this intentionally surfaces unknown-variant handling
    gaps when the experiment flag is misconfigured. random.sample also raises
    (ValueError) when num_return is negative, surfacing the missing input
    validation on the results-cap config flag.
    """
    strategies = {
        # "popularity" is the production default; random.sample stands in for a
        # popularity-weighted pick in the demo.
        "popularity": lambda: random.sample(products, num_return),
        "random": lambda: random.sample(products, num_return),
        "recent": lambda: products[-num_return:] if num_return >= 0 else products[num_return:],
    }
    return strategies[strategy]()


def get_product_list(request_product_ids):
    global cached_ids
    with tracer.start_as_current_span("get_product_list") as span:
        # Formulate the list of characters to list of strings
        request_product_ids_str = ''.join(request_product_ids)
        request_product_ids = request_product_ids_str.split(',')

        # --- Ops/kill-switch flag: in-memory catalog cache ----------------------
        caching_enabled = featbit_client.caching_enabled()
        span.set_attribute("app.recommendation.caching_enabled", caching_enabled)
        if caching_enabled:
            if not cached_ids:
                span.set_attribute("app.cache_hit", False)
                logger.info("get_product_list: cache miss")
                cat_response = product_catalog_stub.ListProducts(demo_pb2.Empty())
                cached_ids = [x.id for x in cat_response.products]
            else:
                span.set_attribute("app.cache_hit", True)
                logger.info("get_product_list: cache hit")
            product_ids = cached_ids
        else:
            cat_response = product_catalog_stub.ListProducts(demo_pb2.Empty())
            product_ids = [x.id for x in cat_response.products]

        span.set_attribute("app.products.count", len(product_ids))

        # Create a filtered list of products excluding the products received as input
        filtered_products = list(set(product_ids) - set(request_product_ids))
        num_products = len(filtered_products)
        span.set_attribute("app.filtered_products.count", num_products)

        # --- Config flag: cap on number of recommendations returned -------------
        max_results = int(featbit_client.list_max_results())
        span.set_attribute("app.recommendation.max_results", max_results)
        num_return = min(max_results, num_products)

        # --- Experiment flag: ranking strategy ----------------------------------
        strategy = featbit_client.ranking_strategy()
        span.set_attribute("app.recommendation.ranking_strategy", strategy)

        # Fetch product ids using the selected ranking strategy
        prod_list = _rank_products(filtered_products, num_return, strategy)

        span.set_attribute("app.filtered_products.list", prod_list)

        return prod_list


def must_map_env(key: str):
    value = os.environ.get(key)
    if value is None:
        raise Exception(f'{key} environment variable must be set')
    return value


if __name__ == "__main__":
    service_name = must_map_env('OTEL_SERVICE_NAME')

    # Initialize FeatBit (native SDK). Returns gracefully if unconfigured.
    featbit_client.init()

    # Initialize Traces and Metrics
    tracer = trace.get_tracer_provider().get_tracer(service_name)
    meter = metrics.get_meter_provider().get_meter(service_name)
    rec_svc_metrics = init_metrics(meter)

    # Initialize Logs
    logger_provider = LoggerProvider(
        resource=Resource.create(
            {
                'service.name': service_name,
            }
        ),
    )
    set_logger_provider(logger_provider)
    log_exporter = OTLPLogExporter(insecure=True)
    logger_provider.add_log_record_processor(BatchLogRecordProcessor(log_exporter))
    handler = LoggingHandler(level=logging.NOTSET, logger_provider=logger_provider)

    # Attach OTLP handler to logger
    logger = logging.getLogger('main')
    logger.addHandler(handler)

    catalog_addr = must_map_env('PRODUCT_CATALOG_ADDR')
    pc_channel = grpc.insecure_channel(catalog_addr)
    product_catalog_stub = demo_pb2_grpc.ProductCatalogServiceStub(pc_channel)

    # Create gRPC server
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))

    # Add class to gRPC server
    service = RecommendationService()
    demo_pb2_grpc.add_RecommendationServiceServicer_to_server(service, server)
    health_pb2_grpc.add_HealthServicer_to_server(service, server)

    # Start server
    port = must_map_env('RECOMMENDATION_PORT')
    server.add_insecure_port(f'[::]:{port}')
    server.start()
    logger.info(f'Recommendation service started, listening on port {port}')
    server.wait_for_termination()
