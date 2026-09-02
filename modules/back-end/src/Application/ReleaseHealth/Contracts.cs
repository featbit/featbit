#nullable enable
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Application.ReleaseHealth;

// The shared envelope does not prescribe the configuration or authentication fields of future providers.
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record ConnectionWrite(string Name, string ProviderType, int ProviderSchemaVersion,
    JsonElement ProviderConfig, JsonElement Authentication, JsonElement SecretUpdate, long? ExpectedVersion);

public sealed record ConnectionView(Guid Id, Guid EnvironmentId, string Name, string ProviderType,
    int ProviderSchemaVersion, JsonElement ProviderConfig, JsonElement Authentication, int Revision,
    long Version, string Status, DateTimeOffset LastCheckedAt);

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record MetricWrite(string Key, string Name, string ResultSemantics, JsonElement ResultContract);
public sealed record MetricView(Guid Id, Guid ProjectId, Guid MetricVersionId, int Version,
    string Key, string Name, string ResultSemantics, JsonElement ResultContract);

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record BindingWrite(Guid ConnectionId, int ConnectionRevision, string ProviderType,
    int ProviderSchemaVersion, JsonElement ProviderConfig, long? ExpectedVersion);
public sealed record BindingView(Guid Id, Guid EnvironmentId, Guid MetricVersionId, Guid ConnectionId,
    int ConnectionRevision, string ProviderType, int ProviderSchemaVersion, JsonElement ProviderConfig,
    long Revision, DateTimeOffset ValidatedAt);
public sealed record MetricPoint(DateTimeOffset Timestamp, double Value);
public sealed record QueryView(string Status, DateTimeOffset QueriedAt, JsonElement ResultContract,
    IReadOnlyList<MetricPoint> Points, double? FreshnessSeconds);

// Persistence only. Never return or log this document: ProtectedSecrets is not a read model.
public sealed record ReleaseHealthDocument(Guid Id, Guid ScopeId, Guid ProjectId, string Kind,
    string NaturalKey, long Version, string Payload, string? ProtectedSecrets);
public interface IReleaseHealthStore
{
    Task<IReadOnlyList<ReleaseHealthDocument>> ListAsync(Guid scopeId, string kind, CancellationToken ct);
    Task<ReleaseHealthDocument?> FindAsync(Guid scopeId, string kind, Guid id, CancellationToken ct);
    Task PutAsync(ReleaseHealthDocument document, long? expectedVersion, CancellationToken ct);
}
public interface ICredentialProtector
{
    string Protect(string plaintext, string context);
    string Unprotect(string envelope, string context);
}
public sealed record ProviderConnection(JsonElement Configuration, JsonElement Authentication,
    IReadOnlyDictionary<string, string> Secrets);
public interface IMetricSourceProvider
{
    string Type { get; }
    int SchemaVersion { get; }
    ProviderConnection Validate(ConnectionWrite write, ProviderConnection? existing);
    JsonElement ReadAuthentication(ProviderConnection connection, DateTimeOffset? rotatedAt);
    JsonElement ValidateBinding(JsonElement configuration);
    Task TestAsync(ProviderConnection connection, CancellationToken ct);
    Task<IReadOnlyList<MetricPoint>> QueryAsync(ProviderConnection connection, JsonElement binding,
        DateTimeOffset start, DateTimeOffset end, CancellationToken ct);
}
