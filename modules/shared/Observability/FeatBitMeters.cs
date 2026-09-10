#nullable enable

namespace Domain.Observability;

/// <summary>
/// Canonical <see cref="System.Diagnostics.Metrics.Meter"/> names and instrument-name prefixes.
/// </summary>
/// <remarks>
/// <para>
/// Meter names are stable by policy. <c>OTEL_DOTNET_AUTO_METRICS_ADDITIONAL_SOURCES</c> is keyed on
/// the meter name, so renaming one invalidates deployed export configuration. Introduce a new meter
/// rather than renaming an existing one.
/// </para>
/// <para>
/// This assembly is shared by all three services, so it carries the constants for all of them.
/// One vocabulary in one place is the point: it makes the estate-wide naming and cardinality rules
/// mechanically checkable. See <c>docs/observability/index.md</c>.
/// </para>
/// </remarks>
public static class FeatBitMeters
{
    /// <summary>Meter for the API server (<c>modules/back-end</c>).</summary>
    public const string Api = "FeatBit.Api";

    /// <summary>Meter for the control plane (<c>modules/control-plane</c>).</summary>
    public const string ControlPlane = "FeatBit.ControlPlane";

    /// <summary>Meter for the evaluation server (<c>modules/evaluation-server</c>).</summary>
    public const string EvaluationServer = "FeatBit.EvaluationServer";

    /// <summary>
    /// Pre-existing control-plane consistency meter. Retained verbatim: renaming it would break
    /// export configuration keyed on the meter name.
    /// </summary>
    public const string ControlPlaneConsistency = "FeatBit.ControlPlane.Consistency";

    /// <summary>
    /// Pre-existing evaluation-server consistency meter. Retained verbatim: renaming it would break
    /// export configuration keyed on the meter name.
    /// </summary>
    public const string EvaluationServerConsistency = "FeatBit.EvaluationServer.Consistency";
}

/// <summary>
/// Instrument-name prefixes, per the <c>featbit.&lt;service&gt;.&lt;area&gt;.&lt;name&gt;</c>
/// convention. Units are never encoded in an instrument name; they belong in the instrument's
/// <c>unit</c> field.
/// </summary>
public static class FeatBitInstruments
{
    /// <summary>Prefix for API-server instruments.</summary>
    public const string ApiPrefix = "featbit.api.";

    /// <summary>Prefix for control-plane instruments.</summary>
    public const string ControlPlanePrefix = "featbit.control_plane.";

    /// <summary>Prefix for evaluation-server instruments.</summary>
    public const string EvaluationServerPrefix = "featbit.evaluation_server.";
}

/// <summary>
/// The finite attribute-name allowlist from <c>docs/observability/index.md</c> §3. Using these
/// constants rather than string literals keeps call sites consistent and makes the cardinality
/// rule mechanically checkable in tests.
/// </summary>
public static class ObservabilityTags
{
    /// <summary>Outcome of an operation. See <see cref="Outcomes"/>.</summary>
    public const string Outcome = "outcome";

    /// <summary>Operation name, drawn from a fixed set per call site.</summary>
    public const string Operation = "operation";

    /// <summary>Backing technology: <c>postgres</c>, <c>mongodb</c>, <c>redis</c>, <c>kafka</c>.</summary>
    public const string Provider = "provider";

    /// <summary>Topic or queue name, from the fixed topic constants.</summary>
    public const string Destination = "destination";

    /// <summary><c>flag</c> or <c>segment</c>.</summary>
    public const string ResourceType = "resource_type";

    /// <summary>Data-center identifier; bounded by deployment topology.</summary>
    public const string DcId = "dc_id";

    /// <summary><c>client</c>, <c>server</c>, or <c>relay_proxy</c>.</summary>
    public const string ConnectionType = "connection_type";

    /// <summary>A close or rejection reason from a fixed enumeration.</summary>
    public const string Reason = "reason";

    /// <summary>Exception type name. Never the exception message.</summary>
    public const string ErrorType = "error_type";

    /// <summary>Background-worker name; bounded by the number of worker types.</summary>
    public const string Worker = "worker";

    /// <summary>Buffer name; bounded by the number of buffers.</summary>
    public const string Buffer = "buffer";

    /// <summary>Propagation stage name. See <see cref="PropagationStages"/>.</summary>
    public const string Stage = "stage";

    /// <summary>
    /// Attribute names that must never appear on a metric, per the cardinality budget
    /// (<c>docs/observability/index.md</c> §4). Enforced by test.
    /// </summary>
    public static readonly IReadOnlyList<string> Banned = new[]
    {
        "env_id", "envId", "environment_id",
        "instance_id", "instanceId",
        "workspace_id", "workspaceId",
        "organization_id", "organizationId",
        "flag_key", "flagKey", "flag_id", "flagId",
        "segment_key", "segmentKey", "segment_id", "segmentId",
        "user_id", "userId", "end_user_id", "endUserId", "user_key", "userKey",
        "token", "secret", "url", "uri",
        "client.ip", "client_ip", "ip",
        "message", "payload", "exception"
    };
}

/// <summary>Canonical values for the <see cref="ObservabilityTags.Outcome"/> attribute.</summary>
public static class Outcomes
{
    /// <summary>The operation completed successfully.</summary>
    public const string Success = "success";

    /// <summary>The operation failed.</summary>
    public const string Failure = "failure";

    /// <summary>The operation exceeded its time budget.</summary>
    public const string Timeout = "timeout";

    /// <summary>The operation was refused deliberately (validation, authorization, rate limit).</summary>
    public const string Rejected = "rejected";

    /// <summary>The item was discarded, typically because a buffer was full.</summary>
    public const string Dropped = "dropped";

    /// <summary>
    /// Handed to a transport that does not confirm delivery. Producers are fire-and-forget, so this
    /// is the strongest claim a publish path can currently make.
    /// </summary>
    public const string Enqueued = "enqueued";

    /// <summary>Allowed only because the gating dependency was unavailable.</summary>
    public const string FailOpen = "fail_open";
}
