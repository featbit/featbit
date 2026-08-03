// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0
//
// FeatBit native server-side SDK integration for the payment service.
//
// Design goals (see e2e/control-plane continuity/failover testing) — mirrors
// the recommendation service's featbit_client.py:
//   * Use FeatBit's NATIVE Node SDK (@featbit/node-server-sdk), not OpenFeature.
//   * One FbClient for the process lifetime (FeatBit best practice).
//   * Graceful degradation: if FeatBit is unconfigured, the eval/streaming
//     server is unreachable, or a flag is not found, every evaluation returns a
//     SAFE DEFAULT and the service keeps working. This is what lets us kill the
//     eval-server / break flags and observe continuity. We NEVER throw on a
//     connection failure or a missing flag.
//   * BUT a *misconfigured* flag value (a negative retry count, an unknown
//     payment provider) is returned faithfully to the caller. Surfacing how the
//     application copes with bad-but-present flag values is the whole point of
//     the resiliency exercise, so we do NOT sanitize those here.
//
// CommonJS module (the payment service uses require, not import).

const { FbClientBuilder, UserBuilder } = require("@featbit/node-server-sdk");
const logger = require("./logger");

// FeatBit evaluation context. The `key` must stably and uniquely identify the
// evaluation subject; for service-scoped operational/release flags the subject
// is the payment service itself.
const SERVICE_USER = new UserBuilder("payment-service")
  .name("payment-service")
  .build();

// Flag keys (kebab-case, intention-revealing, one concern each).
const FLAG_FRAUD_CHECK_ENABLED = "payment-fraud-check-enabled"; // ops/kill-switch (bool)
const FLAG_RETRY_ATTEMPTS = "payment-retry-attempts";          // config         (number)
const FLAG_PROVIDER = "payment-provider";                       // experiment     (string)

// Safe defaults — preserve the service's normal behavior when FeatBit can't be
// reached or a flag is absent.
const DEFAULT_FRAUD_CHECK_ENABLED = true;
const DEFAULT_RETRY_ATTEMPTS = 0;
const DEFAULT_PROVIDER = "default";

let _client = null;
let _ready = false;

/**
 * Initialize a single FeatBit client for the process lifetime.
 *
 * Resolves to the FbClient on success, or null (and the service falls back to
 * safe defaults) when FeatBit is not configured or initialization fails — so
 * the payment service runs even with no flag backend. Never throws.
 */
async function init() {
  const envSecret = process.env.FEATBIT_ENV_SECRET;
  // Accept either FEATBIT_EVENT_URL or FEATBIT_EVAL_URL for the events endpoint.
  const eventUrl = process.env.FEATBIT_EVENT_URL || process.env.FEATBIT_EVAL_URL;
  const streamingUrl = process.env.FEATBIT_STREAMING_URL;

  if (!(envSecret && eventUrl && streamingUrl)) {
    logger.info(
      "FeatBit not configured (need FEATBIT_ENV_SECRET, " +
        "FEATBIT_EVENT_URL/FEATBIT_EVAL_URL, FEATBIT_STREAMING_URL); " +
        "payment flags will use safe defaults"
    );
    return null;
  }

  try {
    _client = new FbClientBuilder()
      .sdkKey(envSecret)
      .streamingUri(streamingUrl)
      .eventsUri(eventUrl)
      .build();

    // waitForInitialization may throw / reject if the eval-server is
    // unreachable. We catch it: the SDK keeps reconnecting in the background,
    // and until it is connected, evaluations return their defaults (graceful
    // failover) rather than crashing the service.
    await _client.waitForInitialization();
    _ready = true;
    logger.info(
      `FeatBit client initialized (event=${eventUrl} streaming=${streamingUrl})`
    );
    return _client;
  } catch (e) {
    logger.warn(
      `FeatBit init failed (${e && e.message ? e.message : e}); ` +
        "payment flags will use safe defaults"
    );
    // Keep the client object around if it was built — it may finish connecting
    // later. But mark it not-ready so evaluations fall back to defaults until
    // it does. If the SDK object itself is unusable, drop it.
    _ready = false;
    return null;
  }
}

async function close() {
  if (_client !== null) {
    try {
      await _client.close();
    } catch (e) {
      // best-effort shutdown
    }
  }
}

/**
 * Evaluate a flag, always returning a usable value.
 *
 * flag-not-found, client-not-ready, and eval-server-down all return `def`
 * (non-breaking). A present-but-misconfigured value is returned as-is.
 */
async function _variation(evalFn, key, def) {
  if (_client === null) {
    return def;
  }
  try {
    return await evalFn(key, SERVICE_USER, def);
  } catch (e) {
    logger.warn(
      `FeatBit evaluation error for '${key}' ` +
        `(${e && e.message ? e.message : e}); using default`
    );
    return def;
  }
}

/** bool — gate the (safe, simulated) fraud-check step. */
async function fraudCheckEnabled() {
  const v = await _variation(
    (k, u, d) => _client.boolVariation(k, u, d),
    FLAG_FRAUD_CHECK_ENABLED,
    DEFAULT_FRAUD_CHECK_ENABLED
  );
  return Boolean(v);
}

/**
 * number — retry attempts on a simulated transient failure.
 *
 * Returned verbatim. Intentionally NOT clamped to a sane range: an operator
 * misconfiguring this to a negative value or an absurdly large value exercises
 * the charge path's (missing) input validation. See charge.js.
 */
async function paymentRetryAttempts() {
  return _variation(
    (k, u, d) => _client.numberVariation(k, u, d),
    FLAG_RETRY_ATTEMPTS,
    DEFAULT_RETRY_ATTEMPTS
  );
}

/**
 * string — selects the payment provider path.
 *
 * Returned verbatim. An unrecognized provider is handled by an unchecked
 * lookup in charge.js and surfaces a real error (intentional unknown-variant
 * gap).
 */
async function paymentProvider() {
  return _variation(
    (k, u, d) => _client.stringVariation(k, u, d),
    FLAG_PROVIDER,
    DEFAULT_PROVIDER
  );
}

module.exports = {
  init,
  close,
  fraudCheckEnabled,
  paymentRetryAttempts,
  paymentProvider,
  // exported for visibility / tests
  FLAG_FRAUD_CHECK_ENABLED,
  FLAG_RETRY_ATTEMPTS,
  FLAG_PROVIDER,
  DEFAULT_FRAUD_CHECK_ENABLED,
  DEFAULT_RETRY_ATTEMPTS,
  DEFAULT_PROVIDER,
};
