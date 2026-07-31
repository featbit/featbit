# Copyright The OpenTelemetry Authors
# SPDX-License-Identifier: Apache-2.0
#
# FeatBit-instrumented llm service (otel-demo 2.2.0 base).
# Adds featbit_client.py alongside the upstream files and runs the Flask app
# under opentelemetry-instrument so flag values can be recorded as span
# attributes.

FROM docker.io/library/python:3.12-alpine3.22 AS build-venv

RUN apk update && \
    apk add gcc g++ linux-headers

COPY ./src/llm/requirements.txt requirements.txt

RUN python -m venv venv && \
    venv/bin/pip install --no-cache-dir -r requirements.txt

RUN venv/bin/opentelemetry-bootstrap -a install

FROM docker.io/library/python:3.12-alpine3.22

COPY --from=build-venv /venv/ /venv/

WORKDIR /app

COPY ./src/llm/app.py app.py
COPY ./src/llm/featbit_client.py featbit_client.py
COPY ./src/llm/product-review-summaries/product-review-summaries.json product-review-summaries.json
COPY ./src/llm/product-review-summaries/inaccurate-product-review-summaries.json inaccurate-product-review-summaries.json

EXPOSE ${LLM_PORT}
ENTRYPOINT [ "/venv/bin/opentelemetry-instrument", "/venv/bin/python", "app.py" ]
