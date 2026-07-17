# Copyright The OpenTelemetry Authors
# SPDX-License-Identifier: Apache-2.0
#
# FeatBit-instrumented checkout service (otel-demo 2.2.0 base).
# Adds featbit.go alongside main.go and the FeatBit native Go SDK dependency.


FROM golang:1.24-bookworm AS builder

WORKDIR /usr/src/app/

# This overlay adds a new dependency (github.com/featbit/featbit-go-sdk), so the
# upstream go.sum is incomplete. Instead of `go mod download` against a fixed
# go.sum, copy the module files AND all source first, then run `go mod tidy`,
# which resolves the new require and regenerates go.sum before the build.
COPY ./src/checkout/go.mod go.mod
COPY ./src/checkout/go.sum go.sum
COPY ./src/checkout/genproto/oteldemo/ genproto/oteldemo/
COPY ./src/checkout/kafka/ kafka/
COPY ./src/checkout/money/ money/
COPY ./src/checkout/main.go main.go
COPY ./src/checkout/featbit.go featbit.go

RUN go mod tidy

# Build the whole package (`.`) so both main.go and featbit.go are compiled.
RUN CGO_ENABLED=0 GOOS=linux GO111MODULE=on go build -ldflags "-s -w" -o checkout .

FROM gcr.io/distroless/static-debian12:nonroot

WORKDIR /usr/src/app/

COPY --from=builder /usr/src/app/checkout ./

EXPOSE ${CHECKOUT_PORT}
ENTRYPOINT [ "./checkout" ]
