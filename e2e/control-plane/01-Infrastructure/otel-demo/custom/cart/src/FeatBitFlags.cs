// Copyright The OpenTelemetry Authors
// SPDX-License-Identifier: Apache-2.0
//
// FeatBit native server-side SDK integration for the cart service.
//
// Design goals (mirrors recommendation/featbit_client.py; see e2e/control-plane
// continuity/failover testing):
//   * Use FeatBit's NATIVE .NET SDK (FeatBit.ServerSdk), not OpenFeature.
//   * One FbClient for the process lifetime (FeatBit best practice).
//   * Graceful degradation: if FeatBit is unconfigured, the eval/streaming
//     server is unreachable, or a flag is not found, every evaluation returns a
//     SAFE DEFAULT and the cart service keeps working. This is what lets us kill
//     the eval-server / break flags and observe continuity.
//   * BUT a *misconfigured* flag value (e.g. a negative cart-max-items) is
//     returned verbatim to the caller. Surfacing how the application copes with
//     bad-but-present flag values is the whole point of the resiliency exercise,
//     so we do NOT sanitize those here.

using System;
using FeatBit.Sdk.Server;
using FeatBit.Sdk.Server.Model;
using FeatBit.Sdk.Server.Options;
using Microsoft.Extensions.Logging;

namespace cart;

/// <summary>
/// Process-wide accessor for the cart service's FeatBit feature flags. A single
/// <see cref="FbClient"/> is created at startup via <see cref="Init"/>; flag
/// getters are exposed through the static <see cref="Instance"/>. When FeatBit is
/// not configured the instance holds a null client and every getter returns its
/// safe default, so the service runs with no FeatBit backend at all.
/// </summary>
public sealed class FeatBitFlags
{
    // Flag keys (kebab-case, intention-revealing, one concern each).
    public const string FlagPersistenceEnabled = "cart-persistence-enabled"; // ops kill-switch (bool)
    public const string FlagMaxItems           = "cart-max-items";           // config          (number)
    public const string FlagReadonlyMode       = "cart-readonly-mode";       // ops             (bool)

    // Safe defaults — preserve the cart service's normal behavior when FeatBit
    // can't be reached or a flag is absent.
    public const bool DefaultPersistenceEnabled = true;
    public const int  DefaultMaxItems           = 100;
    public const bool DefaultReadonlyMode       = false;

    // FeatBit evaluation subject. The key must stably and uniquely identify the
    // evaluation subject; for service-scoped operational/release flags the
    // subject is the cart service itself.
    private static readonly FbUser ServiceUser =
        FbUser.Builder("cart-service").Name("cart-service").Build();

    // Default instance has no client, so getters return safe defaults until (and
    // unless) Init() wires up a connected client.
    public static FeatBitFlags Instance { get; private set; } = new FeatBitFlags(null, null);

    private readonly FbClient _client;
    private readonly ILogger _logger;

    private FeatBitFlags(FbClient client, ILogger logger)
    {
        _client = client;
        _logger = logger;
    }

    /// <summary>
    /// Initialize a single FeatBit client for the process lifetime. Call once at
    /// startup. Never throws: when FeatBit is not configured, or init fails, the
    /// instance falls back to a null client and all flags use safe defaults so
    /// the cart service still runs.
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
                "FEATBIT_STREAMING_URL); cart flags will use safe defaults");
            Instance = new FeatBitFlags(null, logger);
            return;
        }

        try
        {
            var options = new FbOptionsBuilder(envSecret)
                .Event(new Uri(eventUrl))
                .Streaming(new Uri(streamingUrl))
                // Keep startup wait short so a slow/unreachable eval-server never
                // blocks the cart service from starting. The SDK keeps
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
                    "FeatBit client not yet connected; cart flags use defaults until the eval-server is reachable");
            }

            Instance = new FeatBitFlags(client, logger);
        }
        catch (Exception ex)
        {
            // Never let flag wiring crash the service.
            logger?.LogWarning(ex, "FeatBit init failed; cart flags will use safe defaults");
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
    /// cart-persistence-enabled (ops kill-switch). When false, AddItem skips the
    /// Valkey/redis-backed write and falls back to a safe no-op; non-breaking
    /// either way. Default: true.
    /// </summary>
    public bool CartPersistenceEnabled()
    {
        if (_client is null) return DefaultPersistenceEnabled;
        try
        {
            return _client.BoolVariation(FlagPersistenceEnabled, ServiceUser, DefaultPersistenceEnabled);
        }
        catch (Exception ex)
        {
            LogEvalError(FlagPersistenceEnabled, ex);
            return DefaultPersistenceEnabled;
        }
    }

    /// <summary>
    /// cart-max-items (config). Maximum quantity accepted by a single AddItem.
    /// Returned verbatim (numeric) and intentionally NOT clamped to a sane range:
    /// an operator misconfiguring this to a negative value exercises the cart
    /// service's (missing) input validation in CartService.AddItem. Default: 100.
    /// </summary>
    public int CartMaxItems()
    {
        if (_client is null) return DefaultMaxItems;
        try
        {
            return _client.IntVariation(FlagMaxItems, ServiceUser, DefaultMaxItems);
        }
        catch (Exception ex)
        {
            LogEvalError(FlagMaxItems, ex);
            return DefaultMaxItems;
        }
    }

    /// <summary>
    /// cart-readonly-mode (ops). When true, AddItem returns a clean gRPC
    /// rejection (a deliberate feature, not a crash). Default: false.
    /// </summary>
    public bool CartReadonlyMode()
    {
        if (_client is null) return DefaultReadonlyMode;
        try
        {
            return _client.BoolVariation(FlagReadonlyMode, ServiceUser, DefaultReadonlyMode);
        }
        catch (Exception ex)
        {
            LogEvalError(FlagReadonlyMode, ex);
            return DefaultReadonlyMode;
        }
    }

    private void LogEvalError(string key, Exception ex)
        => _logger?.LogWarning(ex, "FeatBit evaluation error for '{FlagKey}'; using default", key);
}
