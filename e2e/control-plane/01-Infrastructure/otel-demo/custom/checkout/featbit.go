// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0
//
// FeatBit native server-side SDK integration for the checkout service.
//
// Design goals (see e2e/control-plane continuity/failover testing):
//   - Use FeatBit's NATIVE Go SDK (github.com/featbit/featbit-go-sdk), NOT
//     OpenFeature. (The upstream service keeps its own OpenFeature/flagd wiring
//     for the unrelated demo chaos flags like paymentUnreachable and
//     kafkaQueueProblems; this file is an independent, additive FeatBit client.)
//   - One client for the process lifetime (FeatBit best practice).
//   - Graceful degradation: if FeatBit is unconfigured, the eval/streaming
//     server is unreachable, or a flag is not found, every evaluation returns a
//     SAFE DEFAULT and the service keeps working. This is what lets us kill the
//     eval-server / break flags and observe checkout continuity.
//   - BUT a *misconfigured* flag value (an unrecognized shipping strategy) is
//     returned faithfully to the caller. Surfacing how the application copes
//     with bad-but-present flag values is the whole point of the resiliency
//     exercise, so we do NOT sanitize those here — the caller's switch turns an
//     unknown value into a real gRPC error.
package main

import (
	"fmt"
	"os"

	featbit "github.com/featbit/featbit-go-sdk"
	"github.com/featbit/featbit-go-sdk/interfaces"
)

// Flag keys (kebab-case, intention-revealing, one concern each).
const (
	flagCheckoutEnabled  = "operational-checkout-enabled"      // operational (bool)
	flagExpressCheckout  = "release-express-checkout"          // release     (bool)
	flagShippingStrategy = "experiment-shipping-cost-strategy" // experiment  (string)
)

// Safe defaults — preserve the service's normal behavior when FeatBit can't be
// reached or a flag is absent.
const (
	defaultCheckoutEnabled  = true       // checkout open for business
	defaultExpressCheckout  = false      // express/one-click path off
	defaultShippingStrategy = "standard" // ordinary shipping quote, unchanged
)

// featBit wraps a single FeatBit client plus the service-scoped evaluation user.
// A nil client means "disabled mode": every getter returns its safe default and
// the service runs with NO FeatBit backend.
type featBit struct {
	client *featbit.FBClient
	user   interfaces.FBUser
}

// fb is the process-wide FeatBit handle. It is never nil after initFeatBit():
// in disabled mode fb.client is nil and all getters fall back to safe defaults.
var fb = &featBit{}

// initFeatBit initializes a single FeatBit client for the process lifetime.
//
// It reads FEATBIT_ENV_SECRET, FEATBIT_EVENT_URL (or FEATBIT_EVAL_URL) and
// FEATBIT_STREAMING_URL. If any are unset, or the client cannot be created at
// all (invalid secret/URL), the service operates in disabled mode (safe
// defaults). If the eval-server is merely unreachable at startup, the SDK still
// returns a usable client that serves defaults and reconnects in the
// background — so flags "heal" automatically once connectivity returns.
func initFeatBit() {
	envSecret := os.Getenv("FEATBIT_ENV_SECRET")
	// Accept either FEATBIT_EVENT_URL or FEATBIT_EVAL_URL for the events endpoint.
	eventURL := os.Getenv("FEATBIT_EVENT_URL")
	if eventURL == "" {
		eventURL = os.Getenv("FEATBIT_EVAL_URL")
	}
	streamingURL := os.Getenv("FEATBIT_STREAMING_URL")

	if envSecret == "" || eventURL == "" || streamingURL == "" {
		logger.Info("FeatBit not configured (need FEATBIT_ENV_SECRET, " +
			"FEATBIT_EVENT_URL/FEATBIT_EVAL_URL, FEATBIT_STREAMING_URL); " +
			"checkout flags will use safe defaults")
		return
	}

	// Service-scoped evaluation subject. The key must stably and uniquely
	// identify the subject; for service-scoped operational/release flags the
	// subject is the checkout service itself.
	user, err := interfaces.NewUserBuilder("checkout").
		UserName("checkout").
		Build()
	if err != nil {
		logger.Warn(fmt.Sprintf("FeatBit user build failed (%v); "+
			"checkout flags will use safe defaults", err))
		return
	}

	// NewFBClient(envSecret, streamingUrl, eventUrl). Note the streaming/event
	// argument order. On a connect timeout or "initialization failed" the SDK
	// still returns a NON-NIL client that serves defaults and keeps retrying;
	// it returns nil ONLY when the config is invalid (bad secret/URL).
	client, err := featbit.NewFBClient(envSecret, streamingURL, eventURL)
	if err != nil {
		if client == nil {
			logger.Warn(fmt.Sprintf("FeatBit client could not be created (%v); "+
				"checkout flags will use safe defaults", err))
			return
		}
		logger.Warn(fmt.Sprintf("FeatBit client not yet connected (%v); "+
			"evaluations use defaults until the eval-server is reachable", err))
	}

	fb.client = client
	fb.user = user
	if client.IsInitialized() {
		logger.Info(fmt.Sprintf("FeatBit client initialized (streaming=%s event=%s)",
			streamingURL, eventURL))
	}
}

// close shuts down the FeatBit client (flushes pending events). Safe to call in
// disabled mode.
func (f *featBit) close() {
	if f != nil && f.client != nil {
		_ = f.client.Close()
	}
}

// boolVariation evaluates a boolean flag, never panicking. flag-not-found,
// client-not-ready and eval-server-down all return def (non-breaking).
func (f *featBit) boolVariation(key string, def bool) (val bool) {
	val = def
	if f == nil || f.client == nil {
		return
	}
	defer func() {
		if r := recover(); r != nil {
			logger.Warn(fmt.Sprintf("FeatBit eval panic for %q (%v); using default", key, r))
			val = def
		}
	}()
	v, _, err := f.client.BoolVariation(key, f.user, def)
	if err != nil {
		logger.Warn(fmt.Sprintf("FeatBit eval error for %q (%v); using default", key, err))
		return def
	}
	return v
}

// stringVariation evaluates a string flag, never panicking. A present-but-bad
// value (e.g. an unrecognized shipping strategy) is returned VERBATIM — the
// caller is responsible for how it copes, which is the point of the resiliency
// exercise.
func (f *featBit) stringVariation(key string, def string) (val string) {
	val = def
	if f == nil || f.client == nil {
		return
	}
	defer func() {
		if r := recover(); r != nil {
			logger.Warn(fmt.Sprintf("FeatBit eval panic for %q (%v); using default", key, r))
			val = def
		}
	}()
	v, _, err := f.client.Variation(key, f.user, def)
	if err != nil {
		logger.Warn(fmt.Sprintf("FeatBit eval error for %q (%v); using default", key, err))
		return def
	}
	return v
}

// checkoutEnabled is the master operational kill-switch. When it evaluates to
// false the caller returns a clean gRPC error instead of placing an order; this
// is deliberate operational behavior, NOT a crash.
func (f *featBit) checkoutEnabled() bool {
	return f.boolVariation(flagCheckoutEnabled, defaultCheckoutEnabled)
}

// expressCheckoutEnabled gates the (simple, safe) express/one-click code path.
func (f *featBit) expressCheckoutEnabled() bool {
	return f.boolVariation(flagExpressCheckout, defaultExpressCheckout)
}

// shippingCostStrategy selects the A/B shipping cost strategy. Returned VERBATIM
// with NO validation here, so an unrecognized value reaches the caller's switch
// and produces a real error for the gRPC caller (intentional resiliency gap).
func (f *featBit) shippingCostStrategy() string {
	return f.stringVariation(flagShippingStrategy, defaultShippingStrategy)
}
