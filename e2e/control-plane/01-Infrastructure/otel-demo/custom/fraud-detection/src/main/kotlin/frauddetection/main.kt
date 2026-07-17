/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

package frauddetection

import org.apache.kafka.clients.consumer.ConsumerConfig.*
import org.apache.kafka.clients.consumer.KafkaConsumer
import org.apache.kafka.common.serialization.ByteArrayDeserializer
import org.apache.kafka.common.serialization.StringDeserializer
import org.apache.logging.log4j.LogManager
import org.apache.logging.log4j.Logger
import oteldemo.Demo.*
import io.opentelemetry.api.GlobalOpenTelemetry
import io.opentelemetry.api.trace.Span
import io.opentelemetry.api.trace.StatusCode
import io.opentelemetry.api.trace.Tracer
import java.time.Duration.ofMillis
import java.util.*
import kotlin.math.abs
import kotlin.system.exitProcess

const val topic = "orders"
const val groupID = "fraud-detection"

private val logger: Logger = LogManager.getLogger(groupID)
private val tracer: Tracer = GlobalOpenTelemetry.getTracer(groupID)

/**
 * Per-percentile (0..100) risk-tier lookup. The configured FeatBit risk threshold is used to index
 * directly into this table WITHOUT range validation (see the assessment loop below), mirroring the
 * ad service's unchecked ad-max-count subList: an in-range 0-100 threshold resolves a tier, while a
 * negative or >100 threshold raises an IndexOutOfBoundsException -- the intentional resiliency gap.
 */
private val RISK_TIERS: List<String> = (0..100).map { p ->
    when {
        p < 50 -> "low"
        p < 80 -> "medium"
        else -> "high"
    }
}

fun main() {
    // Initialize FeatBit's NATIVE Java SDK (one client for the process lifetime). If FeatBit is
    // unconfigured or unreachable, every flag getter falls back to a safe default and the consumer
    // keeps running.
    FeatBitFlags.init()
    Runtime.getRuntime().addShutdownHook(Thread { FeatBitFlags.close() })

    val props = Properties()
    props[KEY_DESERIALIZER_CLASS_CONFIG] = StringDeserializer::class.java.name
    props[VALUE_DESERIALIZER_CLASS_CONFIG] = ByteArrayDeserializer::class.java.name
    props[GROUP_ID_CONFIG] = groupID
    val bootstrapServers = System.getenv("KAFKA_ADDR")
    if (bootstrapServers == null) {
        println("KAFKA_ADDR is not supplied")
        exitProcess(1)
    }
    props[BOOTSTRAP_SERVERS_CONFIG] = bootstrapServers
    val consumer = KafkaConsumer<String, ByteArray>(props).apply {
        subscribe(listOf(topic))
    }

    var totalCount = 0L

    consumer.use {
        while (true) {
            totalCount = consumer
                .poll(ofMillis(100))
                .fold(totalCount) { accumulator, record ->
                    val newCount = accumulator + 1
                    val orders = OrderResult.parseFrom(record.value())
                    assessOrder(orders)
                    logger.info("Consumed record with orderId: ${orders.orderId}, and updated total count to: $newCount")
                    newCount
                }
        }
    }
}

/**
 * Assess a single order for fraud, driven by three FeatBit feature flags. Each flag value is also
 * recorded as a span attribute for observability.
 *
 * Resiliency design:
 *  - FeatBit being unreachable / a flag missing -> safe defaults (handled in [FeatBitFlags]); this
 *    method never fails for those reasons.
 *  - A misconfigured experiment-fraud-risk-threshold (outside 0-100) is applied WITHOUT validation
 *    and raises an IndexOutOfBoundsException when indexing [RISK_TIERS]. We surface that on the span
 *    as an ERROR and log it (mirroring the ad service surfacing the bad value to its caller) but
 *    keep the consumer alive so one poisoned flag value does not silently disappear yet also does
 *    not crash the whole consumer loop.
 */
private fun assessOrder(order: OrderResult) {
    val span = tracer.spanBuilder("fraud-detection assess").startSpan()
    val scope = span.makeCurrent()
    try {
        // --- FeatBit flags (native Java SDK from Kotlin) ------------------------------------
        val checksEnabled = FeatBitFlags.fraudChecksEnabled()
        val mlModelV2 = FeatBitFlags.mlModelV2Enabled()
        val threshold = FeatBitFlags.riskThreshold()

        span.setAttribute("app.fraud.orderId", order.orderId)
        span.setAttribute("app.fraud.featbit.checks_enabled", checksEnabled)
        span.setAttribute("app.fraud.featbit.ml_model_v2", mlModelV2)
        span.setAttribute("app.fraud.featbit.risk_threshold", threshold.toLong())

        // operational-fraud-checks-enabled (operational kill-switch): when disabled, skip scoring
        // entirely and approve. Safe graceful degradation.
        if (!checksEnabled) {
            span.setAttribute("app.fraud.assessment", "approved")
            span.setAttribute("app.fraud.checks_skipped", true)
            logger.info("orderId=${order.orderId} fraud checks DISABLED (operational kill-switch); approved without scoring")
            return
        }

        // Deterministic pseudo risk score in 0..99 derived from the order id, so the same order
        // always scores the same. release-ml-fraud-model-v2 selects a (safe) alternate scoring path.
        var riskScore = abs(order.orderId.hashCode()) % 100
        val model: String
        if (mlModelV2) {
            // v2 release path: a minimal, safe alternate computation (tighter scoring).
            model = "ml-v2"
            riskScore = (riskScore + 5).coerceAtMost(99)
        } else {
            model = "v1"
        }
        span.setAttribute("app.fraud.model", model)
        span.setAttribute("app.fraud.risk_score", riskScore.toLong())

        // experiment-fraud-risk-threshold applied WITHOUT range validation. RISK_TIERS has indices
        // 0..100; a negative or >100 threshold throws IndexOutOfBoundsException here (intentional
        // resiliency gap). 80 (default) and other in-range values are safe.
        val tierAtThreshold = RISK_TIERS[threshold]
        val flagged = riskScore >= threshold
        val assessment = if (flagged) "flagged" else "approved"

        span.setAttribute("app.fraud.threshold_tier", tierAtThreshold)
        span.setAttribute("app.fraud.assessment", assessment)
        logger.info(
            "orderId=${order.orderId} model=$model riskScore=$riskScore threshold=$threshold " +
                "tier=$tierAtThreshold -> $assessment"
        )
    } catch (e: RuntimeException) {
        // A present-but-bad flag value (out-of-range risk threshold) lands here. We do NOT sanitize
        // it: record the real error on the span and log it, then continue consuming. This is the
        // intentional resiliency gap -- misconfigured flag values surface as errors.
        span.recordException(e)
        span.setStatus(StatusCode.ERROR, "fraud assessment failed: ${e}")
        logger.warn("orderId=${order.orderId} fraud assessment failed due to flag value: ${e}")
    } finally {
        scope.close()
        span.end()
    }
}
