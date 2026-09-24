#nullable enable
using System.Text.Json.Serialization;

namespace Application.ReleaseHealth;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record MonitorStatusWrite(long ExpectedRevision, bool Enabled);

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record MonitorBindingWrite(long ExpectedRevision, Guid MetricId, Guid MetricVersionId,
    string Purpose, IReadOnlyList<MonitorRuleWrite>? Rules = null);

// Evaluation evidence and server revisions are deliberately absent from write contracts.
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record MonitorRuleWrite(Guid Id, string Name, string Operator, double Threshold,
    string Severity, int Lookback, string Reducer, int Sustain, int Recovery,
    int EvaluationInterval, int Warmup, int DataDelay, Guid WebhookId);

public sealed record MonitorRuleView(Guid Id, string Name, string Operator, double Threshold,
    string Severity, int Lookback, string Reducer, int Sustain, int Recovery,
    int EvaluationInterval, int Warmup, int DataDelay, Guid WebhookId,
    long Revision, DateTimeOffset EffectiveAt);

public sealed record MonitorBindingView(Guid Id, Guid MetricId, Guid MetricVersionId,
    int MetricVersion, DateTimeOffset CreatedAt, long Revision, bool Enabled,
    string ObservationMode, string Purpose, IReadOnlyList<MonitorRuleView>? Rules,
    MetricView Metric, DateTimeOffset EffectiveAt, bool SourceConnected = false);

public sealed record MonitorMetricView(MetricView Metric, bool SourceConnected);

public sealed record MonitorView(Guid FlagId, bool Enabled, long Revision,
    IReadOnlyList<MonitorBindingView> Bindings);

// Configuration events are retained atomically with the current aggregate. Before/after
// binding snapshots preserve removed rules and pinned metric contracts without accepting
// client timestamps or duplicating the whole monitor on each edit.
public sealed record MonitorConfigurationChange(long Revision, DateTimeOffset EffectiveAt,
    Guid ActorId, string Source, string Operation, bool Enabled,
    MonitorBindingView? Before, MonitorBindingView? After);

public sealed record MonitorState(MonitorView Current, string FlagKey, string FlagName,
    IReadOnlyList<MonitorConfigurationChange> History);
