/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

package frauddetection

import co.featbit.commons.model.FBUser
import co.featbit.server.FBConfig
import co.featbit.server.FBClientImp
import co.featbit.server.exterior.FBClient
import java.time.Duration
import org.apache.logging.log4j.LogManager
import org.apache.logging.log4j.Logger

/**
 * FeatBit native server-side SDK integration for the fraud-detection service (Kotlin).
 *
 * This is the Kotlin twin of the ad service's FeatBitFlags.java helper. Design goals (see the
 * e2e/control-plane continuity/failover testing):
 *
 *  - Use FeatBit's NATIVE Java SDK (co.featbit:featbit-java-sdk) directly from Kotlin, NOT
 *    OpenFeature. (The upstream flagd flag this service used to read is intentionally dropped.)
 *  - ONE [FBClient] for the process lifetime (FeatBit best practice).
 *  - Graceful degradation: if FeatBit is unconfigured, the eval/streaming server is unreachable,
 *    or a flag is not found, every evaluation returns a SAFE DEFAULT and the service keeps
 *    consuming orders. This is what lets us kill the eval-server / break flags and observe
 *    continuity. The service must run with NO FeatBit and never throw on a connection error or a
 *    missing flag.
 *  - BUT a *misconfigured* flag value (e.g. a risk threshold outside 0-100) is returned faithfully
 *    to the caller. Surfacing how the application copes with bad-but-present flag values is the
 *    whole point of the resiliency exercise, so we do NOT sanitize those here -- the consuming code
 *    in main.kt is intentionally left without range validation.
 */
object FeatBitFlags {

    private val logger: Logger = LogManager.getLogger(FeatBitFlags::class.java)

    // Flag keys (kebab-case, intention-revealing, one concern each).
    const val FLAG_FRAUD_CHECKS_ENABLED = "operational-fraud-checks-enabled" // operational kill-switch (bool)
    const val FLAG_ML_MODEL_V2 = "release-ml-fraud-model-v2"                  // release gate (bool)
    const val FLAG_RISK_THRESHOLD = "experiment-fraud-risk-threshold"        // experiment / A-B (number)

    // Safe defaults -- preserve the service's normal behavior when FeatBit can't be reached or a
    // flag is absent.
    //   checks enabled -> true  (scoring runs normally)
    //   ml model v2     -> false (stay on the proven v1 scoring path)
    //   risk threshold  -> 80    (flag transactions scoring >= 80; an in-range, safe value)
    const val DEFAULT_FRAUD_CHECKS_ENABLED = true
    const val DEFAULT_ML_MODEL_V2 = false
    const val DEFAULT_RISK_THRESHOLD = 80

    // FeatBit evaluation context. The key must stably and uniquely identify the evaluation subject;
    // for service-scoped operational/release/experiment flags the subject is the service itself.
    private val SERVICE_USER: FBUser = FBUser.Builder("fraud-detection").userName("fraud-detection").build()

    @Volatile
    private var client: FBClient? = null

    /**
     * Initialize a single FeatBit client for the process lifetime.
     *
     * Leaves the client null (so the service falls back to safe defaults) when FeatBit is not
     * configured or initialization fails, so fraud-detection runs even with no flag backend.
     * Never throws.
     */
    @Synchronized
    fun init() {
        val envSecret = System.getenv("FEATBIT_ENV_SECRET")
        // Accept either FEATBIT_EVENT_URL or FEATBIT_EVAL_URL for the events endpoint.
        val eventUrl = firstNonEmpty(System.getenv("FEATBIT_EVENT_URL"), System.getenv("FEATBIT_EVAL_URL"))
        val streamingUrl = System.getenv("FEATBIT_STREAMING_URL")

        if (isEmpty(envSecret) || isEmpty(eventUrl) || isEmpty(streamingUrl)) {
            logger.info(
                "FeatBit not configured (need FEATBIT_ENV_SECRET, FEATBIT_EVENT_URL/FEATBIT_EVAL_URL, " +
                    "FEATBIT_STREAMING_URL); fraud-detection flags will use safe defaults"
            )
            return
        }

        try {
            // startWaitTime kept short so a slow/unreachable eval-server never blocks startup. The
            // SDK keeps reconnecting in the background; until it is connected, evaluations return
            // their defaults (graceful failover).
            val config = FBConfig.Builder()
                .streamingURL(streamingUrl)
                .eventURL(eventUrl)
                .startWaitTime(Duration.ofSeconds(5))
                .build()
            val c = FBClientImp(envSecret, config)
            client = c
            if (c.isInitialized) {
                logger.info("FeatBit client initialized (event={} streaming={})", eventUrl, streamingUrl)
            } else {
                logger.warn(
                    "FeatBit client not yet connected; evaluations use defaults until the eval-server " +
                        "is reachable"
                )
            }
        } catch (e: Exception) {
            // never let flag wiring crash the service
            logger.warn("FeatBit init failed ({}); fraud-detection flags will use safe defaults", e.toString())
            client = null
        }
    }

    /** Close the FeatBit client on shutdown. Never throws. */
    fun close() {
        val c = client
        if (c != null) {
            try {
                c.close()
            } catch (ignored: Exception) {
                // best effort
            }
        }
    }

    /**
     * operational-fraud-checks-enabled (operational / bool). Ops kill-switch. Default true keeps
     * scoring running; when an operator sets it false the consumer skips scoring and treats every
     * order as approved (safe graceful degradation). flag-not-found / client-not-ready /
     * eval-server-down return the safe default (true).
     */
    fun fraudChecksEnabled(): Boolean {
        val c = client ?: return DEFAULT_FRAUD_CHECKS_ENABLED
        return try {
            c.boolVariation(FLAG_FRAUD_CHECKS_ENABLED, SERVICE_USER, DEFAULT_FRAUD_CHECKS_ENABLED)
        } catch (e: Exception) {
            logger.warn("FeatBit eval error for '{}' ({}); using default", FLAG_FRAUD_CHECKS_ENABLED, e.toString())
            DEFAULT_FRAUD_CHECKS_ENABLED
        }
    }

    /**
     * release-ml-fraud-model-v2 (release / bool). Release gate for a new ML scoring code path.
     * Default false keeps the proven v1 path. Safe either way (records a span attribute and takes a
     * minimal alternate branch). flag-not-found / eval-down return the safe default (false).
     */
    fun mlModelV2Enabled(): Boolean {
        val c = client ?: return DEFAULT_ML_MODEL_V2
        return try {
            c.boolVariation(FLAG_ML_MODEL_V2, SERVICE_USER, DEFAULT_ML_MODEL_V2)
        } catch (e: Exception) {
            logger.warn("FeatBit eval error for '{}' ({}); using default", FLAG_ML_MODEL_V2, e.toString())
            DEFAULT_ML_MODEL_V2
        }
    }

    /**
     * experiment-fraud-risk-threshold (experiment / number). A/B risk threshold (0-100) at or above
     * which a transaction is flagged.
     *
     * Returned VERBATIM. Intentionally NOT clamped to the valid 0-100 range: the value is applied
     * without validation in main.kt (used to index a per-percentile risk-tier table), so an operator
     * misconfiguring this to a negative or >100 value exercises the service's (missing) input
     * validation and surfaces a real error on the assessment. flag-not-found / client-not-ready /
     * eval-server-down still return the safe default (80).
     */
    fun riskThreshold(): Int {
        val c = client ?: return DEFAULT_RISK_THRESHOLD
        return try {
            c.intVariation(FLAG_RISK_THRESHOLD, SERVICE_USER, DEFAULT_RISK_THRESHOLD)
        } catch (e: Exception) {
            logger.warn("FeatBit eval error for '{}' ({}); using default", FLAG_RISK_THRESHOLD, e.toString())
            DEFAULT_RISK_THRESHOLD
        }
    }

    private fun isEmpty(s: String?): Boolean = s == null || s.trim().isEmpty()

    private fun firstNonEmpty(a: String?, b: String?): String? = if (!isEmpty(a)) a else b
}
