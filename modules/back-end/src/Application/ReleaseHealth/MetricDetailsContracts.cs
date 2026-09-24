#nullable enable
using System.Text.Json.Serialization;

namespace Application.ReleaseHealth;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record MetricUpdateWrite(string Name, string ResultSemantics, string? Description,
    string? Category, double? Minimum, double? Maximum, int FractionDigits, long ExpectedRevision);

public sealed record MetricChangeField(string Field, string? Before, string? After);
public sealed record MetricChangeView(Guid Id, Guid MetricId, Guid? EnvironmentId, int MetricVersion,
    string Kind, string Operation, DateTimeOffset OccurredAt, Guid ActorId, string ActorName,
    string Source, IReadOnlyList<MetricChangeField> Fields);

public sealed record MetricMonitorBindingView(Guid Id, Guid MetricId, Guid MetricVersionId,
    int MetricVersion, Guid FlagId, string FlagKey, string MonitorName, string Status,
    string Use, string Window, string Rule, string? LatestCheck = null, DateTimeOffset? CheckedAt = null,
    DateTimeOffset? CreatedAt = null);
