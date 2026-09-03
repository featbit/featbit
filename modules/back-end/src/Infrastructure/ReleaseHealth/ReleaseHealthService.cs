using System.Text.Json;
using System.Text.RegularExpressions;
using System.Security.Cryptography;
using System.Text;
using Application.Bases.Exceptions;
using Application.ReleaseHealth;
using Microsoft.Extensions.Logging;

namespace Infrastructure.ReleaseHealth;

public sealed class ReleaseHealthService(IReleaseHealthStore store, ICredentialProtector protector,
    IEnumerable<IMetricSourceProvider> providers, IEnvironmentService environments, IProjectService projects,
    ILogger<ReleaseHealthService> logger)
{
    private sealed record ConnectionState(string Name, string ProviderType, int ProviderSchemaVersion,
        JsonElement ProviderConfig, JsonElement Authentication, int Revision, DateTimeOffset LastCheckedAt, DateTimeOffset? LastRotatedAt, string Status = "connected");
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static string Serialize<T>(T value) => JsonSerializer.Serialize(value, JsonOptions);
    private static T Read<T>(ReleaseHealthDocument document) => JsonSerializer.Deserialize<T>(document.Payload, JsonOptions)!;
    private IMetricSourceProvider Provider(string type, int version) => providers.SingleOrDefault(x => x.Type == type && x.SchemaVersion == version) ?? throw Schema.Invalid("unsupported_provider_schema");
    private static EntityNotFoundException Missing(Guid id) => new("ReleaseHealth", id.ToString());

    public async Task Scope(Guid orgId, Guid projectId, Guid? envId = null)
    {
        var project = await projects.FindOneAsync(x => x.Id == projectId && x.OrganizationId == orgId);
        if (project is null) throw Missing(projectId);
        if (envId is not null && !await environments.AnyAsync(x => x.Id == envId && x.ProjectId == projectId)) throw Missing(envId.Value);
    }
    private async Task<ReleaseHealthDocument> Required(Guid scopeId, string kind, Guid id, CancellationToken ct) => await store.FindAsync(scopeId, kind, id, ct) ?? throw Missing(id);
    private static void Expected(ReleaseHealthDocument? document, long? expected)
    {
        if (document?.Version != expected) throw new ConflictException("ReleaseHealth", document?.Id ?? Guid.Empty);
    }
    private static string Context(ReleaseHealthDocument document, ConnectionState state)
    {
        // Authenticate the destination and identity metadata too: a DB-only attacker must not
        // be able to retarget a valid ciphertext to a different endpoint or Basic username.
        var metadata = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(state.ProviderConfig.GetRawText() + "\n" + state.Authentication.GetRawText())));
        return $"{document.ProjectId}:{document.ScopeId}:{document.Id}:{state.ProviderType}:{state.ProviderSchemaVersion}:authentication:{metadata}";
    }
    private ProviderConnection Resolve(ReleaseHealthDocument document)
    {
        var state = Read<ConnectionState>(document);
        var secrets = document.ProtectedSecrets is null ? new Dictionary<string, string>() : JsonSerializer.Deserialize<Dictionary<string, string>>(protector.Unprotect(document.ProtectedSecrets, Context(document, state)))!;
        return new(state.ProviderConfig, state.Authentication, secrets);
    }
    private ConnectionView View(ReleaseHealthDocument document)
    {
        var state = Read<ConnectionState>(document);
        // Listing does not decrypt credentials, and cannot expose ciphertext/reference fields.
        var auth = Provider(state.ProviderType, state.ProviderSchemaVersion).ReadAuthentication(new(state.ProviderConfig, state.Authentication, new Dictionary<string, string>()), state.LastRotatedAt);
        return new(document.Id, document.ScopeId, state.Name, state.ProviderType, state.ProviderSchemaVersion, state.ProviderConfig, auth, state.Revision, document.Version, state.Status, state.LastCheckedAt);
    }
    public async Task<IReadOnlyList<ConnectionView>> Connections(Guid envId, CancellationToken ct) => (await store.ListAsync(envId, "connection", ct)).Select(View).ToArray();

    public async Task<ConnectionView?> TestOrSave(Guid projectId, Guid envId, Guid? id, ConnectionWrite write, Guid actor, bool save, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(write.Name) || write.Name.Length > 120 || write.Name.Any(char.IsControl)) throw Schema.Invalid("invalid_connection_name");
        var provider = Provider(write.ProviderType, write.ProviderSchemaVersion);
        var previous = id is null ? null : await Required(envId, "connection", id.Value, ct);
        Expected(previous, write.ExpectedVersion);
        var oldState = previous is null ? null : Read<ConnectionState>(previous);
        if (oldState is not null && (oldState.ProviderType != provider.Type || oldState.ProviderSchemaVersion != provider.SchemaVersion)) throw Schema.Invalid("provider_change_requires_new_connection");
        var keeping = Schema.Text(write.SecretUpdate, "operation") == "keep";
        var existing = previous is null ? null : keeping ? Resolve(previous) : new ProviderConnection(oldState!.ProviderConfig, oldState.Authentication, new Dictionary<string, string>());
        var candidate = provider.Validate(write, existing);
        var connectionId = id ?? Guid.NewGuid();
        try { await provider.TestAsync(candidate, ct); }
        catch
        {
            logger.LogWarning("ReleaseHealth connection test failed. Environment={EnvironmentId} Connection={ConnectionId} Actor={Actor}", envId, connectionId, actor);
            throw;
        }
        logger.LogInformation("ReleaseHealth connection test passed. Environment={EnvironmentId} Connection={ConnectionId} Actor={Actor}", envId, connectionId, actor);
        if (!save) return null;
        var changed = oldState is not null && (!JsonElement.DeepEquals(oldState.ProviderConfig, candidate.Configuration) || !JsonElement.DeepEquals(oldState.Authentication, candidate.Authentication));
        var rotated = Schema.Text(write.SecretUpdate, "operation") == "replace";
        var now = DateTimeOffset.UtcNow;
        var state = new ConnectionState(write.Name.Trim(), provider.Type, provider.SchemaVersion, candidate.Configuration, candidate.Authentication,
            (oldState?.Revision ?? 1) + (changed ? 1 : 0), now, candidate.Secrets.Count == 0 ? null : rotated ? now : oldState?.LastRotatedAt);
        var document = new ReleaseHealthDocument(connectionId, envId, projectId, "connection", connectionId.ToString(), (previous?.Version ?? 0) + 1, Serialize(state), null);
        if (candidate.Secrets.Count > 0) document = document with { ProtectedSecrets = protector.Protect(Serialize(candidate.Secrets), Context(document, state)) };
        // A CAS prevents a slower test/save from overwriting a concurrent edit or credential rotation.
        await store.PutAsync(document, write.ExpectedVersion, ct);
        logger.LogInformation("ReleaseHealth connection saved. Environment={EnvironmentId} Connection={ConnectionId} Actor={Actor} Revision={Revision} CredentialReplaced={Rotated}", envId, connectionId, actor, state.Revision, rotated);
        return View(document);
    }

    public async Task TestSaved(Guid envId, Guid id, Guid actor, CancellationToken ct)
    {
        var document = await Required(envId, "connection", id, ct);
        var state = Read<ConnectionState>(document);
        try { await Provider(state.ProviderType, state.ProviderSchemaVersion).TestAsync(Resolve(document), ct); }
        catch (BusinessException)
        {
            await store.PutAsync(document with { Version = document.Version + 1, Payload = Serialize(state with { LastCheckedAt = DateTimeOffset.UtcNow, Status = "unavailable" }) }, document.Version, ct);
            logger.LogWarning("ReleaseHealth saved connection unavailable. Environment={EnvironmentId} Connection={ConnectionId} Actor={Actor}", envId, id, actor);
            throw;
        }
        await store.PutAsync(document with { Version = document.Version + 1, Payload = Serialize(state with { LastCheckedAt = DateTimeOffset.UtcNow, Status = "connected" }) }, document.Version, ct);
        logger.LogInformation("ReleaseHealth saved connection tested. Environment={EnvironmentId} Connection={ConnectionId} Actor={Actor}", envId, id, actor);
    }

    public async Task<IReadOnlyList<MetricView>> Metrics(Guid projectId, CancellationToken ct) => (await store.ListAsync(projectId, "metric", ct)).Select(Read<MetricView>).ToArray();
    public async Task<MetricView> CreateMetric(Guid projectId, MetricWrite write, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(write.Key) || !Regex.IsMatch(write.Key, "^[a-z][a-z0-9_]{0,99}$") ||
            string.IsNullOrWhiteSpace(write.Name) || write.Name.Length > 120 || string.IsNullOrWhiteSpace(write.ResultSemantics) || write.ResultSemantics.Length > 2000) throw Schema.Invalid("invalid_metric");
        if (write.Description?.Length > 2000 || write.Category is not (null or "impact" or "quality" or "reliability") ||
            write.FractionDigits is < 0 or > 4) throw Schema.Invalid("invalid_metric_metadata");
        if (write.ResultSemantics.Trim().Length < 12 || string.Equals(write.ResultSemantics.Trim(), write.Name.Trim(), StringComparison.OrdinalIgnoreCase))
            throw Schema.Invalid("invalid_metric_semantics");
        Schema.ResultContract(write.ResultContract);
        var metric = new MetricView(Guid.NewGuid(), projectId, Guid.NewGuid(), 1, write.Key, write.Name.Trim(), write.ResultSemantics.Trim(), write.ResultContract,
            write.Description?.Trim(), write.Category, write.FractionDigits ?? 2);
        await store.PutAsync(new(metric.Id, projectId, projectId, "metric", metric.Key, 1, Serialize(metric), null), null, ct);
        return metric;
    }

    public async Task<BindingView?> Binding(Guid projectId, Guid envId, Guid metricId, CancellationToken ct)
    {
        var metric = Read<MetricView>(await Required(projectId, "metric", metricId, ct));
        var document = await store.FindAsync(envId, "binding", metric.MetricVersionId, ct);
        return document is null ? null : Read<BindingView>(document);
    }
    public async Task<(QueryView Query, BindingView Binding)> PreviewOrSaveBinding(Guid projectId, Guid envId, Guid metricId, BindingWrite write, bool save, Guid actor, CancellationToken ct)
    {
        var metric = Read<MetricView>(await Required(projectId, "metric", metricId, ct));
        var previous = await store.FindAsync(envId, "binding", metric.MetricVersionId, ct);
        Expected(previous, write.ExpectedVersion);
        var connection = await Required(envId, "connection", write.ConnectionId, ct);
        var state = Read<ConnectionState>(connection);
        if (state.Revision != write.ConnectionRevision || state.ProviderType != write.ProviderType || state.ProviderSchemaVersion != write.ProviderSchemaVersion) throw Schema.Invalid("connection_changed_revalidate");
        var provider = Provider(write.ProviderType, write.ProviderSchemaVersion);
        var config = provider.ValidateBinding(write.ProviderConfig);
        var query = await Query(metric, connection, config, 15, ct);
        var binding = new BindingView(metric.MetricVersionId, envId, metric.MetricVersionId, connection.Id, state.Revision,
            provider.Type, provider.SchemaVersion, config, (previous?.Version ?? 0) + 1, DateTimeOffset.UtcNow);
        if (save)
        {
            // Recheck after network I/O; a subsequent connection edit will also invalidate future reads.
            var latest = await Required(envId, "connection", connection.Id, ct);
            if (latest.Version != connection.Version) throw Schema.Invalid("connection_changed_revalidate");
            await store.PutAsync(new(binding.Id, envId, projectId, "binding", binding.Id.ToString(), binding.Revision, Serialize(binding), null), write.ExpectedVersion, ct);
            logger.LogInformation("ReleaseHealth binding saved. Environment={EnvironmentId} Metric={MetricId} Revision={Revision} Actor={Actor}", envId, metricId, binding.Revision, actor);
        }
        return (query, binding);
    }
    public async Task<QueryView> Trend(Guid projectId, Guid envId, Guid metricId, int minutes, CancellationToken ct)
    {
        if (minutes is < 1 or > 60) throw Schema.Invalid("invalid_time_range");
        var metric = Read<MetricView>(await Required(projectId, "metric", metricId, ct));
        var binding = await Binding(projectId, envId, metricId, ct);
        if (binding is null) return new("not_connected", DateTimeOffset.UtcNow, metric.ResultContract, [], null);
        var connection = await Required(envId, "connection", binding.ConnectionId, ct);
        if (Read<ConnectionState>(connection).Revision != binding.ConnectionRevision) throw Schema.Invalid("connection_changed_revalidate");
        var result = await Query(metric, connection, binding.ProviderConfig, minutes, ct);
        return result with { Source = new(binding.ProviderType, Read<ConnectionState>(connection).Name, Schema.Text(binding.ProviderConfig, "step")) };
    }
    private async Task<QueryView> Query(MetricView metric, ReleaseHealthDocument connection, JsonElement config, int minutes, CancellationToken ct)
    {
        var state = Read<ConnectionState>(connection);
        var end = DateTimeOffset.FromUnixTimeSeconds(DateTimeOffset.UtcNow.ToUnixTimeSeconds());
        var points = await Provider(state.ProviderType, state.ProviderSchemaVersion).QueryAsync(Resolve(connection), config, end.AddMinutes(-minutes), end, ct);
        var (minimum, maximum) = Schema.ResultContract(metric.ResultContract);
        if (points.Any(x => x.Value < minimum || x.Value > maximum)) throw Schema.Invalid("result_outside_contract");
        double? freshness = points.Count == 0 ? null : Math.Max(0, (end - points[^1].Timestamp).TotalSeconds);
        var status = points.Count == 0 ? "no_data" : freshness > 120 ? "stale" : "ready";
        return new(status, end, metric.ResultContract, points, freshness);
    }
}
