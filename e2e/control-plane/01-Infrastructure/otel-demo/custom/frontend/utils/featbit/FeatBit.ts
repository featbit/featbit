// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0
//
// FeatBit native server-side SDK integration for the Next.js frontend.
//
// Design goals (see e2e/control-plane continuity/failover testing) — mirrors
// the payment service's featbit.js and the recommendation service's
// featbit_client.py:
//   * Use FeatBit's NATIVE Node SERVER SDK (@featbit/node-server-sdk),
//     evaluated SERVER-SIDE only (in pages/api/*.ts route handlers). This is
//     NOT OpenFeature and NOT the client/browser SDK.
//   * A single FbClient (lazy singleton) for the process lifetime — the
//     FeatBit best practice. The frontend has no explicit boot hook, so the
//     client is initialized on first evaluation and reused thereafter.
//   * Graceful degradation: if FeatBit is unconfigured, the eval/streaming
//     server is unreachable, or a flag is not found, every evaluation returns
//     a SAFE DEFAULT and the storefront keeps rendering. This is what lets us
//     kill the eval-server / break flags and observe continuity. We NEVER
//     throw on a connection failure or a missing flag.
//   * BUT a *misconfigured* flag value (e.g. an unknown checkout button
//     variant) is returned faithfully to the caller. Surfacing how the
//     application copes with bad-but-present flag values is the whole point of
//     the resiliency exercise, so we do NOT sanitize those here. See
//     pages/api/checkout.ts for the intentional unknown-variant gap.
//
// TypeScript / ESM module. Server-only — never import this from a component
// that runs in the browser.

import { FbClientBuilder, UserBuilder } from '@featbit/node-server-sdk';

// Minimal structural view of the SDK surface we use. Declaring it locally keeps
// the Next.js build robust regardless of the exact type names the SDK exports,
// while still giving us type-checked evaluation calls.
interface FbClientLike {
  waitForInitialization(): Promise<void>;
  boolVariation(key: string, user: unknown, defaultValue: boolean): Promise<boolean>;
  numberVariation(key: string, user: unknown, defaultValue: number): Promise<number>;
  stringVariation(key: string, user: unknown, defaultValue: string): Promise<string>;
  close(): Promise<void>;
}

// FeatBit evaluation context. The `key` must stably and uniquely identify the
// evaluation subject; for service-scoped operational/release/experiment flags
// the subject is the frontend service itself.
const SERVICE_USER: unknown = new UserBuilder('frontend').name('frontend').build();

// Flag keys (kebab-case, intention-revealing, one concern each).
export const FLAG_RELEASE_REDESIGNED_PRODUCT_PAGE = 'release-redesigned-product-page'; // release gate (bool)
export const FLAG_RECOMMENDATIONS_ENABLED = 'operational-recommendations-enabled';     // ops toggle   (bool)
export const FLAG_CHECKOUT_BUTTON_VARIANT = 'experiment-checkout-button-variant';      // experiment   (string)

// Safe defaults — preserve the storefront's normal behavior when FeatBit can't
// be reached or a flag is absent.
export const DEFAULT_RELEASE_REDESIGNED_PRODUCT_PAGE = false;
export const DEFAULT_RECOMMENDATIONS_ENABLED = true;
export const DEFAULT_CHECKOUT_BUTTON_VARIANT = 'control';

// Lazy singleton state.
let client: FbClientLike | null = null;
let initStarted = false;
let initPromise: Promise<void> = Promise.resolve();

/**
 * Initialize a single FeatBit client for the process lifetime.
 *
 * Never throws. When FeatBit is unconfigured we leave `client` null and every
 * evaluation falls back to its safe default. When configured we keep the built
 * client reference even if waitForInitialization rejects — the SDK keeps
 * reconnecting in the background, and until it is connected evaluations return
 * their defaults (graceful failover) rather than crashing the storefront.
 */
async function init(): Promise<void> {
  const envSecret = process.env.FEATBIT_ENV_SECRET;
  // Accept either FEATBIT_EVENT_URL or FEATBIT_EVAL_URL for the events endpoint.
  const eventUrl = process.env.FEATBIT_EVENT_URL || process.env.FEATBIT_EVAL_URL;
  const streamingUrl = process.env.FEATBIT_STREAMING_URL;

  if (!(envSecret && eventUrl && streamingUrl)) {
    console.info(
      '[featbit] not configured (need FEATBIT_ENV_SECRET, ' +
        'FEATBIT_EVENT_URL/FEATBIT_EVAL_URL, FEATBIT_STREAMING_URL); ' +
        'frontend flags will use safe defaults'
    );
    return;
  }

  try {
    const built = new FbClientBuilder()
      .sdkKey(envSecret)
      .streamingUri(streamingUrl)
      .eventsUri(eventUrl)
      .build() as unknown as FbClientLike;

    // Keep the reference immediately so background reconnection benefits later
    // evaluations even if this initial wait times out.
    client = built;

    // waitForInitialization may reject if the eval-server is unreachable. We
    // catch it below: evaluations return defaults until the SDK connects.
    await built.waitForInitialization();
    console.info(`[featbit] client initialized (event=${eventUrl} streaming=${streamingUrl})`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn(`[featbit] init failed (${message}); frontend flags will use safe defaults`);
  }
}

/** Kick off (once) and return the shared initialization promise. */
function ensureInitialized(): Promise<void> {
  if (!initStarted) {
    initStarted = true;
    initPromise = init();
  }
  return initPromise;
}

/**
 * Evaluate a flag, always returning a usable value.
 *
 * flag-not-found, client-not-ready, and eval-server-down all return `def`
 * (non-breaking). A present-but-misconfigured value is returned as-is.
 */
async function variation<T>(
  evalFn: (c: FbClientLike, user: unknown, def: T) => Promise<T>,
  key: string,
  def: T
): Promise<T> {
  await ensureInitialized();
  if (client === null) {
    return def;
  }
  try {
    return await evalFn(client, SERVICE_USER, def);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn(`[featbit] evaluation error for '${key}' (${message}); using default`);
    return def;
  }
}

/**
 * bool — release gate for the redesigned product page layout.
 * Safe either way; default OFF keeps the current layout.
 */
export async function getReleaseRedesignedProductPage(): Promise<boolean> {
  return variation<boolean>(
    (c, u, d) => c.boolVariation(FLAG_RELEASE_REDESIGNED_PRODUCT_PAGE, u, d),
    FLAG_RELEASE_REDESIGNED_PRODUCT_PAGE,
    DEFAULT_RELEASE_REDESIGNED_PRODUCT_PAGE
  );
}

/**
 * bool — operational kill switch for recommendations. When false the
 * recommendations route returns an empty list (graceful degradation, e.g. when
 * the recommendation service is unhealthy). Default ON.
 */
export async function getRecommendationsEnabled(): Promise<boolean> {
  return variation<boolean>(
    (c, u, d) => c.boolVariation(FLAG_RECOMMENDATIONS_ENABLED, u, d),
    FLAG_RECOMMENDATIONS_ENABLED,
    DEFAULT_RECOMMENDATIONS_ENABLED
  );
}

/**
 * string — A/B experiment selecting the checkout button variant
 * (control | variant-a | variant-b). Returned VERBATIM and intentionally NOT
 * validated here. An unrecognized variant is handled by an unchecked lookup in
 * checkout.ts and surfaces a real error (intentional unknown-variant gap).
 */
export async function getCheckoutButtonVariant(): Promise<string> {
  return variation<string>(
    (c, u, d) => c.stringVariation(FLAG_CHECKOUT_BUTTON_VARIANT, u, d),
    FLAG_CHECKOUT_BUTTON_VARIANT,
    DEFAULT_CHECKOUT_BUTTON_VARIANT
  );
}

/** Best-effort shutdown (exported for completeness / tests). */
export async function close(): Promise<void> {
  if (client !== null) {
    try {
      await client.close();
    } catch {
      // best-effort shutdown
    }
  }
}
