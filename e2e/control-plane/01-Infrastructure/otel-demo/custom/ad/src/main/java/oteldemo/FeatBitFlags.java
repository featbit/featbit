/*
 * Copyright The OpenTelemetry Authors
 * SPDX-License-Identifier: Apache-2.0
 */

package oteldemo;

import co.featbit.commons.model.FBUser;
import co.featbit.server.FBConfig;
import co.featbit.server.FBClientImp;
import co.featbit.server.exterior.FBClient;
import java.time.Duration;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

/**
 * FeatBit native server-side SDK integration for the ad service.
 *
 * <p>Design goals (see e2e/control-plane continuity/failover testing) -- this mirrors the
 * philosophy of recommendation/featbit_client.py:
 *
 * <ul>
 *   <li>Use FeatBit's NATIVE Java SDK (co.featbit:featbit-java-sdk), not OpenFeature.
 *   <li>ONE {@link FBClient} for the process lifetime (FeatBit best practice).
 *   <li>Graceful degradation: if FeatBit is unconfigured, the eval/streaming server is
 *       unreachable, or a flag is not found, every evaluation returns a SAFE DEFAULT and the
 *       service keeps working. This is what lets us kill the eval-server / break flags and
 *       observe continuity. The service must run with NO FeatBit and never throw on a
 *       connection error or a missing flag.
 *   <li>BUT a <em>misconfigured</em> flag value (an out-of-range number, an unknown experiment
 *       variant) is returned faithfully to the caller. Surfacing how the application copes with
 *       bad-but-present flag values is the whole point of the resiliency exercise, so we do NOT
 *       sanitize those here -- the consuming code in {@link AdService} is intentionally left
 *       without validation.
 * </ul>
 */
public final class FeatBitFlags {

  private static final Logger logger = LogManager.getLogger(FeatBitFlags.class);

  // Flag keys (kebab-case, intention-revealing, one concern each).
  public static final String FLAG_PERSONALIZATION_ENABLED = "ad-personalization-enabled"; // release (bool)
  public static final String FLAG_MAX_COUNT = "ad-max-count";                             // config  (number)
  public static final String FLAG_CATEGORY = "ad-category";                               // experiment (string)

  // Safe defaults -- preserve the service's normal behavior when FeatBit can't be reached or a
  // flag is absent. ad-max-count default 2 matches the upstream MAX_ADS_TO_SERVE.
  public static final boolean DEFAULT_PERSONALIZATION_ENABLED = false;
  public static final int DEFAULT_MAX_COUNT = 2;
  public static final String DEFAULT_CATEGORY = "all";

  // FeatBit evaluation context. The key must stably and uniquely identify the evaluation
  // subject; for service-scoped operational/release flags the subject is the ad service itself.
  private static final FBUser SERVICE_USER = new FBUser.Builder("ad").userName("ad").build();

  private static volatile FBClient client = null;

  private FeatBitFlags() {}

  /**
   * Initialize a single FeatBit client for the process lifetime.
   *
   * <p>Leaves the client {@code null} (so the service falls back to safe defaults) when FeatBit is
   * not configured or initialization fails, so the ad service runs even with no flag backend.
   * Never throws.
   */
  public static synchronized void init() {
    String envSecret = System.getenv("FEATBIT_ENV_SECRET");
    // Accept either FEATBIT_EVENT_URL or FEATBIT_EVAL_URL for the events endpoint.
    String eventUrl = firstNonEmpty(System.getenv("FEATBIT_EVENT_URL"), System.getenv("FEATBIT_EVAL_URL"));
    String streamingUrl = System.getenv("FEATBIT_STREAMING_URL");

    if (isEmpty(envSecret) || isEmpty(eventUrl) || isEmpty(streamingUrl)) {
      logger.info(
          "FeatBit not configured (need FEATBIT_ENV_SECRET, FEATBIT_EVENT_URL/FEATBIT_EVAL_URL, "
              + "FEATBIT_STREAMING_URL); ad flags will use safe defaults");
      return;
    }

    try {
      // startWaitTime kept short so a slow/unreachable eval-server never blocks startup. The SDK
      // keeps reconnecting in the background; until it is connected, evaluations return their
      // defaults (graceful failover).
      FBConfig config =
          new FBConfig.Builder()
              .streamingURL(streamingUrl)
              .eventURL(eventUrl)
              .startWaitTime(Duration.ofSeconds(5))
              .build();
      FBClient c = new FBClientImp(envSecret, config);
      client = c;
      if (c.isInitialized()) {
        logger.info(
            "FeatBit client initialized (event={} streaming={})", eventUrl, streamingUrl);
      } else {
        logger.warn(
            "FeatBit client not yet connected; evaluations use defaults until the eval-server "
                + "is reachable");
      }
    } catch (Exception e) {
      // never let flag wiring crash the service
      logger.warn("FeatBit init failed ({}); ad flags will use safe defaults", e.toString());
      client = null;
    }
  }

  /** Close the FeatBit client on shutdown. Never throws. */
  public static void close() {
    FBClient c = client;
    if (c != null) {
      try {
        c.close();
      } catch (Exception ignored) {
        // best effort
      }
    }
  }

  /**
   * ad-personalization-enabled (release / bool). Gates a safe personalized-ad code path /
   * span attribute. Default false preserves the current non-personalized behavior.
   */
  public static boolean personalizationEnabled() {
    FBClient c = client;
    if (c == null) {
      return DEFAULT_PERSONALIZATION_ENABLED;
    }
    try {
      return c.boolVariation(FLAG_PERSONALIZATION_ENABLED, SERVICE_USER, DEFAULT_PERSONALIZATION_ENABLED);
    } catch (Exception e) {
      logger.warn("FeatBit eval error for '{}' ({}); using default", FLAG_PERSONALIZATION_ENABLED, e.toString());
      return DEFAULT_PERSONALIZATION_ENABLED;
    }
  }

  /**
   * ad-max-count (config / number). Number of ads to return.
   *
   * <p>Returned VERBATIM. Intentionally NOT clamped to a sane range: the value is applied without
   * validation in {@link AdService}, so an operator misconfiguring this to a negative or
   * too-large value exercises the service's (missing) input validation. flag-not-found /
   * client-not-ready / eval-server-down still return the safe default (2).
   */
  public static int maxCount() {
    FBClient c = client;
    if (c == null) {
      return DEFAULT_MAX_COUNT;
    }
    try {
      return c.intVariation(FLAG_MAX_COUNT, SERVICE_USER, DEFAULT_MAX_COUNT);
    } catch (Exception e) {
      logger.warn("FeatBit eval error for '{}' ({}); using default", FLAG_MAX_COUNT, e.toString());
      return DEFAULT_MAX_COUNT;
    }
  }

  /**
   * ad-category (experiment / string). Which ad category to serve.
   *
   * <p>Returned VERBATIM. An unrecognized category is applied without validation in
   * {@link AdService} (enum valueOf), so an unknown experiment variant surfaces a real error.
   * "all" and known categories are safe. flag-not-found / eval-down return the safe default
   * ("all").
   */
  public static String category() {
    FBClient c = client;
    if (c == null) {
      return DEFAULT_CATEGORY;
    }
    try {
      return c.variation(FLAG_CATEGORY, SERVICE_USER, DEFAULT_CATEGORY);
    } catch (Exception e) {
      logger.warn("FeatBit eval error for '{}' ({}); using default", FLAG_CATEGORY, e.toString());
      return DEFAULT_CATEGORY;
    }
  }

  private static boolean isEmpty(String s) {
    return s == null || s.trim().isEmpty();
  }

  private static String firstNonEmpty(String a, String b) {
    return !isEmpty(a) ? a : b;
  }
}
