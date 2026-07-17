# Copyright The OpenTelemetry Authors
# SPDX-License-Identifier: Apache-2.0
#
# FeatBit-instrumented payment service (otel-demo 2.2.0 base).
# Adds featbit.js alongside the upstream files and the @featbit/node-server-sdk
# dependency. Because package.json gains a dependency that the upstream
# package-lock.json does not contain, the builder uses `npm install --omit=dev`
# (which resolves the new dep) instead of `npm ci` (which requires the lock to
# match package.json exactly).


FROM docker.io/library/node:22-slim AS builder

WORKDIR /usr/src/app/

COPY ./src/payment/package.json package.json
COPY ./src/payment/package-lock.json package-lock.json

RUN npm install --omit=dev

# -----------------------------------------------------------------------------

FROM gcr.io/distroless/nodejs22-debian12:nonroot

WORKDIR /usr/src/app/

COPY --from=builder /usr/src/app/node_modules/ node_modules/

COPY ./pb/demo.proto demo.proto

COPY ./src/payment/charge.js charge.js
COPY ./src/payment/featbit.js featbit.js
COPY ./src/payment/index.js index.js
COPY ./src/payment/logger.js logger.js
COPY ./src/payment/opentelemetry.js opentelemetry.js

EXPOSE ${PAYMENT_PORT}

CMD ["--require=./opentelemetry.js", "index.js"]
