// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0
//
// FeatBit native server-side SDK integration for the accounting service.
//
// Design goals (mirrors custom/cart/src/FeatBitFlags.cs; see e2e/control-plane
// continuity/failover testing):
//   * Use FeatBit's NATIVE .NET SDK (FeatBit.ServerSdk), not OpenFeature.
//   * One FbClient for the process lifetime (FeatBit best practice).
//   * Graceful degradation: if FeatBit is unconfigured, the eval/streaming
//     server is unreachable, or a flag is not found, every evaluation returns a
//     SAFE DEFAULT and the accounting consumer keeps working. This is what lets
//     us kill the eval-server / break flags and observe continuity.
//   * BUT a *misconfigured* flag value is returned verbatim to the caller.
//     Surfacing how the application copes with bad-but-present flag values is the
//     whole point of the resiliency exercise, so we do NOT sanitize those here.
//     In particular experiment-currency-rounding is returned as-is, and an
//     unrecognized strategy is allowed to break ledger amount rounding downstream
//     (see Consumer.RoundLedgerAmount).

using System;
using FeatBit.Sdk.Server;
using FeatBit.Sdk.Server.Model;
using FeatBit.Sdk.Server.Options;
using Microsoft.Extensions.Logging;

namespace Accounting;

/// <summary>
/// Process-wide accessor for the accounting service's FeatBit feature flags. A
/// single <see cref="FbClient"/> is created at startup via <see cref="Init"/>;
/// flag getters are exposed through the static <see cref="Instance"/>. When
/// FeatBit is not configured the instance holds a null client and every getter
/// returns its safe default, so the service runs with no FeatBit backend at all.
/// </summary>
public sealed class FeatBitFlags
{
    // Flag keys (kebab-case, intention-revealing, one concern each). These model a
    // production ecommerce accounting service, not the flagd chaos flags.
    public const string FlagLedgerPersistenceEnabled = "operational-ledger-persistence-enabled"; // ops kill-switch (bool)
    public const string FlagDoubleEntryBookkeeping   = "release-double-entry-bookkeeping";       // release gate    (bool)
    public const string FlagCurrencyRounding         = "experiment-currency-rounding";           // A/B experiment  (string)

    // Safe defaults — preserve the accounting service's normal behavior when
    // FeatBit can't be reached or a flag is absent.
    public const bool   DefaultLedgerPersistenceEnabled = true;
    public const bool   DefaultDoubleEntryBookkeeping   = false;
    public const string DefaultCurrencyRounding         = "bankers";

    // FeatBit evaluation subject. The key must stably and uniquely identify the
    // evaluation subject; for service-scoped operational/release/experiment flags
    // the subject is the accounting service itself.
    private static readonly FbUser ServiceUser =
        FbUser.Builder("accounting").Name("accounting").Build();

    // Default instance has no client, so getters return safe defaults until (and
    // unless) Init() wires up a connected client.
    public static FeatBitFlags Instance { get; private set; } = new FeatBitFlags(null, null);

    private readonly FbClient? _client;
    private readonly ILogger? _logger;

    private FeatBitFlags(FbClient? client, ILogger? logger)
    {
        _client = client;
        _logger = logger;
    }

    /// <summary>
    /// Initialize a single FeatBit client for the process lifetime. Call once at
    /// startup. Never throws: when FeatBit is not configured, or init fails, the
    /// instance falls back to a null client and all flags use safe defaults so
    /// the accounting service still runs.
    /// </summary>
    public static void Init(ILogger logger)
    {
        var envSecret = Environment.GetEnvironmentVariable("FEATBIT_ENV_SECRET");
        // Accept either FEATBIT_EVENT_URL or FEATBIT_EVAL_URL for the events endpoint.
        var eventUrl = Environment.GetEnvironmentVariable("FEATBIT_EVENT_URL")
                       ?? Environment.GetEnvironmentVariable("FEATBIT_EVAL_URL");
        var streamingUrl = Environment.GetEnvironmentVariable("FEATBIT_STREAMING_URL");

        if (string.IsNullOrWhiteSpace(envSecret)
            || string.IsNullOrWhiteSpace(eventUrl)
            || string.IsNullOrWhiteSpace(streamingUrl))
        {
            logger?.LogInformation(
                "FeatBit not configured (need FEATBIT_ENV_SECRET, FEATBIT_EVENT_URL/FEATBIT_EVAL_URL, " +
                "FEATBIT_STREAMING_URL); accounting flags will use safe defaults");
            Instance = new FeatBitFlags(null, logger);
            return;
        }

        try
        {
            var options = new FbOptionsBuilder(envSecret)
                .Event(new Uri(eventUrl))
                .Streaming(new Uri(streamingUrl))
                // Keep startup wait short so a slow/unreachable eval-server never
                // blocks the accounting consumer from starting. The SDK keeps
                // reconnecting in the background; until it is connected,
                // evaluations return their defaults (graceful failover).
                .StartWaitTime(TimeSpan.FromSeconds(5))
                .Build();

            var client = new FbClient(options);
            if (client.Initialized)
            {
                if (logger?.IsEnabled(LogLevel.Information) == true)
                {
                    logger.LogInformation(
                        "FeatBit client initialized (event={EventUrl} streaming={StreamingUrl})",
                        eventUrl, streamingUrl);
                }
            }
            else
            {
                logger?.LogWarning(
                    "FeatBit client not yet connected; accounting flags use defaults until the eval-server is reachable");
            }

            Instance = new FeatBitFlags(client, logger);
        }
        catch (Exception ex)
        {
            // Never let flag wiring crash the service.
            logger?.LogWarning(ex, "FeatBit init failed; accounting flags will use safe defaults");
            Instance = new FeatBitFlags(null, logger);
        }
    }

    /// <summary>Gracefully close the FeatBit client (best-effort, never throws).</summary>
    public static void Shutdown()
    {
        try
        {
            Instance?._client?.CloseAsync().GetAwaiter().GetResult();
        }
        catch
        {
            // ignore — shutdown must not fail the host
        }
    }

    // --- Flag getters -------------------------------------------------------
    // flag-not-found, client-not-ready, and eval-server-down all return the safe
    // default (non-breaking). A present-but-misconfigured value is returned as-is.

    /// <summary>
    /// operational-ledger-persistence-enabled (ops kill-switch). When false, the
    /// consumer still drains the Kafka message but skips writing the ledger entry
    /// — degrade gracefully, safe either way. Default: true.
    /// </summary>
    public bool LedgerPersistenceEnabled()
    {
        if (_client is null) return DefaultLedgerPersistenceEnabled;
        try
        {
            return _client.BoolVariation(FlagLedgerPersistenceEnabled, ServiceUser, DefaultLedgerPersistenceEnabled);
        }
        catch (Exception ex)
        {
            LogEvalError(FlagLedgerPersistenceEnabled, ex);
            return DefaultLedgerPersistenceEnabled;
        }
    }

    /// <summary>
    /// release-double-entry-bookkeeping (release gate). When true, the consumer
    /// runs the new double-entry code path (a balancing debit/credit pass plus a
    /// span attribute). Safe in both states. Default: false.
    /// </summary>
    public bool DoubleEntryBookkeepingEnabled()
    {
        if (_client is null) return DefaultDoubleEntryBookkeeping;
        try
        {
            return _client.BoolVariation(FlagDoubleEntryBookkeeping, ServiceUser, DefaultDoubleEntryBookkeeping);
        }
        catch (Exception ex)
        {
            LogEvalError(FlagDoubleEntryBookkeeping, ex);
            return DefaultDoubleEntryBookkeeping;
        }
    }

    /// <summary>
    /// experiment-currency-rounding (A/B experiment). Selects the rounding
    /// strategy applied to ledger amounts: "bankers" | "half-up" | "truncate".
    /// Returned verbatim and intentionally NOT validated here: an operator setting
    /// this to an unrecognized value exercises the (missing) handling in
    /// Consumer.RoundLedgerAmount, which throws on an unknown strategy. That is
    /// the deliberate resiliency gap. Default: "bankers".
    /// </summary>
    public string CurrencyRoundingStrategy()
    {
        if (_client is null) return DefaultCurrencyRounding;
        try
        {
            return _client.StringVariation(FlagCurrencyRounding, ServiceUser, DefaultCurrencyRounding);
        }
        catch (Exception ex)
        {
            LogEvalError(FlagCurrencyRounding, ex);
            return DefaultCurrencyRounding;
        }
    }

    private void LogEvalError(string key, Exception ex)
        => _logger?.LogWarning(ex, "FeatBit evaluation error for '{FlagKey}'; using default", key);
}
