using System.Text.Json;
using System.Text.Json.Nodes;
using Application.ReleaseHealth;

namespace Infrastructure.ReleaseHealth;

public sealed partial class ReleaseHealthService
{
    public async Task<MetricView> UpdateMetric(Guid projectId, Guid id, MetricUpdateWrite write,
        Guid actor, string source, CancellationToken ct)
    {
        var document = await Required(projectId, "metric", id, ct);
        Expected(document, write.ExpectedRevision);
        var old = Read<MetricView>(document);
        if (string.IsNullOrWhiteSpace(write.Name) || write.Name.Length > 120 ||
            string.IsNullOrWhiteSpace(write.ResultSemantics) || write.ResultSemantics.Trim().Length < 12 ||
            write.ResultSemantics.Length > 2000 || write.Description?.Length > 2000 ||
            write.Category is not (null or "impact" or "quality" or "reliability") ||
            write.FractionDigits is < 0 or > 4 ||
            string.Equals(write.Name.Trim(), write.ResultSemantics.Trim(), StringComparison.OrdinalIgnoreCase))
            throw Schema.Invalid("invalid_metric_metadata");

        // Key, measurement kind, unit and shape are never accepted as writable fields.
        var contract = JsonNode.Parse(old.ResultContract.GetRawText())!;
        var constraints = new JsonObject { ["allowNaN"] = false, ["allowInfinity"] = false };
        if (write.Minimum is { } minimum) constraints["minimum"] = minimum;
        if (write.Maximum is { } maximum) constraints["maximum"] = maximum;
        contract["constraints"] = constraints;
        var resultContract = JsonSerializer.SerializeToElement(contract);
        Schema.ResultContract(resultContract);
        var versionChanged = old.ResultSemantics != write.ResultSemantics.Trim() ||
            !JsonElement.DeepEquals(old.ResultContract, resultContract);
        var metric = old with
        {
            Name = write.Name.Trim(), Description = write.Description?.Trim(), Category = write.Category,
            FractionDigits = write.FractionDigits, ResultSemantics = write.ResultSemantics.Trim(),
            ResultContract = resultContract, Revision = document.Version + 1,
            Version = old.Version + (versionChanged ? 1 : 0),
            MetricVersionId = versionChanged ? Guid.NewGuid() : old.MetricVersionId
        };
        if (versionChanged && await store.FindAsync(projectId, "metric_version", old.MetricVersionId, ct) is null)
            await store.PutAsync(new(old.MetricVersionId, projectId, projectId, "metric_version",
                old.MetricVersionId.ToString(), 1, Serialize(old), null), null, ct);
        await store.PutAsync(document with { Version = metric.Revision, Payload = Serialize(metric) }, write.ExpectedRevision, ct);
        await RecordChange(projectId, null, metric, "metric", versionChanged ? "version_created" : "updated",
            actor, source, DefinitionFields(old), DefinitionFields(metric), ct);
        return metric;
    }

    private static Dictionary<string, string> DefinitionFields(MetricView metric) => new()
    {
        ["name"] = metric.Name, ["description"] = metric.Description ?? "", ["category"] = metric.Category ?? "",
        ["resultSemantics"] = metric.ResultSemantics,
        ["minimum"] = Bound(metric.ResultContract, "minimum"), ["maximum"] = Bound(metric.ResultContract, "maximum"),
        ["fractionDigits"] = (metric.FractionDigits ?? 2).ToString(), ["version"] = metric.Version.ToString()
    };
    private static string Bound(JsonElement contract, string name) =>
        contract.GetProperty("constraints").TryGetProperty(name, out var value) ? value.GetRawText() : "";

    private async Task RecordChange(Guid projectId, Guid? envId, MetricView metric, string kind,
        string operation, Guid actor, string source, Dictionary<string, string> before,
        Dictionary<string, string> after, CancellationToken ct)
    {
        var fields = before.Keys.Union(after.Keys).Where(key => before.GetValueOrDefault(key) != after.GetValueOrDefault(key))
            .Select(key => new MetricChangeField(key, before.GetValueOrDefault(key), after.GetValueOrDefault(key))).ToArray();
        if (fields.Length == 0) return;
        var entry = new MetricChangeView(Guid.NewGuid(), metric.Id, envId, metric.Version, kind, operation,
            DateTimeOffset.UtcNow, actor, actor.ToString(), source, fields);
        await store.PutAsync(new(entry.Id, envId ?? projectId, projectId, "metric_change",
            entry.OccurredAt.ToString("O") + ":" + entry.Id, 1, Serialize(entry), null), null, ct);
    }

    private static Dictionary<string, string> BindingFields(BindingView binding) => new()
    {
        ["provider"] = binding.ProviderType, ["connectionId"] = binding.ConnectionId.ToString(),
        ["connectionRevision"] = binding.ConnectionRevision.ToString(), ["bindingRevision"] = binding.Revision.ToString(),
        ["step"] = Schema.Text(binding.ProviderConfig, "step"),
        // Audit stores an identifier of the query, never its potentially sensitive text.
        ["queryFingerprint"] = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(
            System.Text.Encoding.UTF8.GetBytes(binding.ProviderConfig.GetProperty("promql").GetString()!)))
    };

    private async Task ArchiveBinding(Guid projectId, BindingView binding, CancellationToken ct)
    {
        var naturalKey = binding.Id + ":" + binding.Revision;
        var hash = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(naturalKey));
        var id = new Guid(hash.AsSpan(0, 16));
        if (await store.FindAsync(binding.EnvironmentId, "binding_revision", id, ct) is null)
            await store.PutAsync(new(id, binding.EnvironmentId, projectId, "binding_revision", naturalKey,
                1, Serialize(binding), null), null, ct);
    }

    public async Task<IReadOnlyList<MetricChangeView>> Changes(Guid projectId, Guid envId, Guid metricId,
        DateTimeOffset from, DateTimeOffset to, CancellationToken ct)
    {
        ValidateRange(from, to);
        await Required(projectId, "metric", metricId, ct);
        var projectChanges = await store.ListAsync(projectId, "metric_change", ct);
        var environmentChanges = await store.ListAsync(envId, "metric_change", ct);
        return projectChanges.Concat(environmentChanges).Select(Read<MetricChangeView>)
            .Where(x => x.MetricId == metricId && x.OccurredAt >= from && x.OccurredAt <= to)
            .OrderBy(x => x.OccurredAt).ToArray();
    }

    public async Task<IReadOnlyList<MetricMonitorBindingView>> MonitorBindings(Guid projectId, Guid envId, Guid metricId, CancellationToken ct)
    {
        await Required(projectId, "metric", metricId, ct);
        var monitors = (await store.ListAsync(envId, MonitorKind, ct)).Where(x => x.ProjectId == projectId)
            .Select(Read<MonitorState>).ToArray();
        var legacy = (await store.ListAsync(envId, "monitor_binding", ct)).Where(x => x.ProjectId == projectId)
            .Select(Read<MetricMonitorBindingView>)
            .Where(x => x.MetricId == metricId && !monitors.Any(m => m.Current.FlagId == x.FlagId));
        var current = monitors.SelectMany(m => m.Current.Bindings.Where(x => x.MetricId == metricId).Select(binding =>
            new MetricMonitorBindingView(binding.Id, binding.MetricId, binding.MetricVersionId, binding.MetricVersion,
                m.Current.FlagId, m.FlagKey, m.FlagName + " · Health Monitor",
                m.Current.Enabled && binding.Enabled ? "monitoring" : "paused", binding.Purpose,
                binding.Purpose == "trend" ? "" : string.Join(" / ", binding.Rules!.Select(r => r.Lookback + " min").Distinct()),
                binding.Purpose == "trend" ? "Trend only" : string.Join("; ", binding.Rules!.Select(r =>
                    r.Name + ": " + r.Operator + " " + r.Threshold.ToString(System.Globalization.CultureInfo.InvariantCulture))),
                CreatedAt: binding.CreatedAt)));
        return current.Concat(legacy).ToArray();
    }

    public static void ValidateRange(DateTimeOffset from, DateTimeOffset to)
    {
        if (from >= to || to - from > TimeSpan.FromDays(7) || to > DateTimeOffset.UtcNow.AddMinutes(1))
            throw Schema.Invalid("invalid_time_range");
    }

    public async Task<QueryView> TrendRange(Guid projectId, Guid envId, Guid metricId,
        DateTimeOffset from, DateTimeOffset to, CancellationToken ct)
    {
        ValidateRange(from, to);
        var metric = Read<MetricView>(await Required(projectId, "metric", metricId, ct));
        var binding = await Binding(projectId, envId, metricId, ct);
        if (binding is null) return new("not_connected", DateTimeOffset.UtcNow, metric.ResultContract, [], null);
        var history = (await store.ListAsync(envId, "binding_revision", ct)).Select(Read<BindingView>)
            .Where(x => x.MetricVersionId == metric.MetricVersionId && x.Revision != binding.Revision)
            .Append(binding).OrderBy(x => x.ValidatedAt).ToArray();
        var step = Schema.Text(binding.ProviderConfig, "step");
        List<MetricPoint> points = [];
        for (var index = 0; index < history.Length; index++)
        {
            var revision = history[index];
            var start = index == 0 || from > revision.ValidatedAt ? from : revision.ValidatedAt;
            var endsAtRevision = index + 1 < history.Length && history[index + 1].ValidatedAt <= to;
            var end = endsAtRevision ? history[index + 1].ValidatedAt : to;
            if (start > end || (start == end && endsAtRevision)) continue;
            var connection = await Required(envId, "connection", revision.ConnectionId, ct);
            var state = Read<ConnectionState>(connection);
            if (state.Revision != revision.ConnectionRevision) throw Schema.Invalid("connection_changed_revalidate");
            // Browsing uses the current sampling interval with each segment's historical query.
            // Work on a copy: saved revisions and monitoring evidence retain their original step.
            var config = JsonNode.Parse(revision.ProviderConfig.GetRawText())!;
            config["step"] = step;
            var values = await Provider(state.ProviderType, state.ProviderSchemaVersion)
                .QueryAsync(Resolve(connection), JsonSerializer.SerializeToElement(config), start, end, ct);
            points.AddRange(values.Where(x => !endsAtRevision || x.Timestamp < end)
                .Select(x => x with { SourceBindingRevision = revision.Revision }));
        }
        var (minimum, maximum) = Schema.ResultContract(metric.ResultContract);
        if (points.Any(x => x.Value < minimum || x.Value > maximum)) throw Schema.Invalid("result_outside_contract");
        var latest = points.LastOrDefault();
        // Range availability is relative to the selected end, not today's live freshness.
        double? freshness = latest is null ? null : Math.Max(0, (to - latest.Timestamp).TotalSeconds);
        return new(points.Count == 0 ? "no_data" : freshness > 120 ? "stale" : "ready",
            DateTimeOffset.UtcNow, metric.ResultContract, points, freshness);
    }
}
