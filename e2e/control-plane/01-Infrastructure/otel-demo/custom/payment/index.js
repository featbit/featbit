// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0
const grpc = require('@grpc/grpc-js')
const protoLoader = require('@grpc/proto-loader')
const health = require('grpc-js-health-check')
const opentelemetry = require('@opentelemetry/api')

const charge = require('./charge')
const logger = require('./logger')
const featbit = require('./featbit')

async function chargeServiceHandler(call, callback) {
  const span = opentelemetry.trace.getActiveSpan();

  try {
    const amount = call.request.amount
    span?.setAttributes({
      'app.payment.amount': parseFloat(`${amount.units}.${amount.nanos}`).toFixed(2)
    })
    logger.info({ request: call.request }, "Charge request received.")

    const response = await charge.charge(call.request)
    callback(null, response)

  } catch (err) {
    logger.warn({ err })

    span?.recordException(err)
    span?.setStatus({ code: opentelemetry.SpanStatusCode.ERROR })
    callback(err)
  }
}

async function closeGracefully(signal) {
  // Best-effort: flush/close the FeatBit client before shutting down.
  await featbit.close()
  server.forceShutdown()
  process.kill(process.pid, signal)
}

const otelDemoPackage = grpc.loadPackageDefinition(protoLoader.loadSync('demo.proto'))
const server = new grpc.Server()

server.addService(health.service, new health.Implementation({
  '': health.servingStatus.SERVING
}))

server.addService(otelDemoPackage.oteldemo.PaymentService.service, { charge: chargeServiceHandler })


let ip = "0.0.0.0";

const ipv6_enabled = process.env.IPV6_ENABLED;

if (ipv6_enabled == "true") {
  ip = "[::]";
  logger.info(`Overwriting Localhost IP: ${ip}`)
}

const address = ip + `:${process.env['PAYMENT_PORT']}`;

// Initialize the single FeatBit client once at startup. This never throws:
// if FeatBit is unconfigured or unreachable, flag evaluations fall back to
// safe defaults and the payment service starts normally regardless.
featbit.init()
  .catch(err => logger.warn({ err }, 'FeatBit init error; using safe defaults'))
  .finally(() => {
    server.bindAsync(address, grpc.ServerCredentials.createInsecure(), (err, port) => {
      if (err) {
        return logger.error({ err })
      }

      logger.info(`payment gRPC server started on ${address}`)
    })
  })

process.once('SIGINT', closeGracefully)
process.once('SIGTERM', closeGracefully)
