#nullable enable

namespace Domain.Observability;

/// <summary>
/// Canonical <see cref="System.Diagnostics.ActivitySource"/> names and trace category names.
/// </summary>
/// <remarks>
/// Custom traces are gated and default to off; see <see cref="TraceGate"/> and
/// <c>docs/observability/index.md</c> §8.
/// </remarks>
public static class FeatBitActivitySources
{
    /// <summary>Activity source for the API server (<c>modules/back-end</c>).</summary>
    public const string Api = "FeatBit.Api";

    /// <summary>Activity source for the control plane (<c>modules/control-plane</c>).</summary>
    public const string ControlPlane = "FeatBit.ControlPlane";

    /// <summary>Activity source for the evaluation server (<c>modules/evaluation-server</c>).</summary>
    public const string EvaluationServer = "FeatBit.EvaluationServer";

    private static System.Diagnostics.ActivitySource _ingress = new(Api);

    /// <summary>
    /// The activity source used for ingress activities — HTTP requests, streaming handshakes, and
    /// message-queue consumes.
    /// </summary>
    /// <remarks>
    /// Resolved through a property rather than referenced directly because this assembly and the
    /// projects that create ingress activities are shared across hosts — <c>Infrastructure</c> is
    /// referenced by both the API server and the control plane — so the source name cannot be
    /// decided where the activity is started. Each host calls <see cref="ConfigureIngress"/> once
    /// at startup to name it after itself. <see cref="Api"/> is only the pre-configuration
    /// fallback; it is never the name a running service publishes under.
    /// </remarks>
    public static System.Diagnostics.ActivitySource Ingress => _ingress;

    /// <summary>
    /// The same source under a name that reads correctly at non-ingress call sites — internal
    /// stages such as flag-change persist/publish/relay/fan-out.
    /// </summary>
    /// <remarks>
    /// Deliberately the <i>same object</i>, not a second source. Exporters and
    /// <c>OTEL_DOTNET_AUTO_TRACES_ADDITIONAL_SOURCES</c> key on the source <b>name</b>, so a second
    /// source named identically would add configuration surface and no capability. One property per
    /// intent keeps call sites readable without splitting the operator-facing name.
    /// </remarks>
    public static System.Diagnostics.ActivitySource Service => _ingress;

    /// <summary>
    /// Names the <see cref="Ingress"/> source after the running service. Call once during startup,
    /// before any request is served. Ignores a null or empty name.
    /// </summary>
    public static void ConfigureIngress(string name)
    {
        if (!string.IsNullOrWhiteSpace(name) && name != _ingress.Name)
        {
            _ingress = new System.Diagnostics.ActivitySource(name);
        }
    }
}

/// <summary>
/// Trace categories that can be enabled independently through <see cref="TraceGate"/>.
/// </summary>
public static class TraceCategories
{
    /// <summary>T1 — flag/segment change: persist then publish (API), consume then fan out (ELS).</summary>
    public const string FlagChange = "flag_change";

    /// <summary>T2 — streaming handshake: validate then accept or reject.</summary>
    public const string StreamingHandshake = "streaming_handshake";

    /// <summary>T3 — data-sync payload build: store read, evaluation, and serialization.</summary>
    public const string Sync = "sync";

    /// <summary>T4 — insight and usage ingestion and the batched flush to storage.</summary>
    public const string Insights = "insights";

    /// <summary>
    /// T5 — low-frequency background work: scheduled flag changes and webhook delivery.
    /// </summary>
    public const string ScheduledWork = "scheduled_work";

    /// <summary>Message-queue consume and publish.</summary>
    public const string Messaging = "messaging";
}
