using Application.Bases.Exceptions;
using Application.ReleaseHealth;
using Domain.FeatureFlags;

namespace Infrastructure.ReleaseHealth;

public sealed partial class ReleaseHealthService
{
    private const string MonitorKind = "flag_monitor";
    private const int MaximumMonitorBindings = 100;
    private const int MaximumBindingRules = 50;

    private async Task<(ReleaseHealthDocument? Document, MonitorState State)> LoadMonitor(
        Guid orgId, Guid projectId, Guid envId, FeatureFlag flag, CancellationToken ct, long? expected = null)
    {
        await Scope(orgId, projectId, envId);
        if (flag.Id == Guid.Empty || flag.EnvId != envId) throw Missing(flag.Id);
        var document = await store.FindAsync(envId, MonitorKind, flag.Id, ct);
        if (document is not null && document.ProjectId != projectId) throw Missing(flag.Id);
        var state = document is null
            ? new MonitorState(new(flag.Id, true, 0, []), flag.Key, flag.Name, [])
            : Read<MonitorState>(document);
        if (expected is not null)
        {
            if (flag.IsArchived) throw Schema.Invalid("monitor_flag_archived");
            if (expected < 0 || expected != (document?.Version ?? 0))
                throw new ConflictException("ReleaseHealthMonitor", flag.Id);
        }
        return (document, state);
    }

    public async Task<MonitorView> Monitor(Guid orgId, Guid projectId, Guid envId,
        FeatureFlag flag, CancellationToken ct) => await HydrateMonitor(projectId, envId,
            (await LoadMonitor(orgId, projectId, envId, flag, ct)).State.Current, ct);

    public async Task<IReadOnlyList<MonitorMetricView>> MonitorMetrics(Guid orgId, Guid projectId, Guid envId,
        FeatureFlag flag, CancellationToken ct)
    {
        await LoadMonitor(orgId, projectId, envId, flag, ct);
        var metrics = await Metrics(projectId, ct);
        var result = new List<MonitorMetricView>();
        foreach (var metric in metrics)
            result.Add(new(metric, await MonitorSourceConnected(projectId, envId, metric.MetricVersionId, ct)));
        return result;
    }

    public async Task<MonitorView> SetMonitorStatus(Guid orgId, Guid projectId, Guid envId,
        FeatureFlag flag, MonitorStatusWrite write, Guid actor, string source, CancellationToken ct)
    {
        var (document, state) = await LoadMonitor(orgId, projectId, envId, flag, ct, write.ExpectedRevision);
        if (write.Enabled)
            foreach (var binding in state.Current.Bindings.Where(x => x.Enabled))
                await ValidateEnabledBinding(orgId, projectId, envId, binding, ct);
        if (state.Current.Enabled == write.Enabled) return await HydrateMonitor(projectId, envId, state.Current, ct);
        return await SaveMonitor(projectId, envId, flag, document, state,
            state.Current with { Enabled = write.Enabled }, "monitor_status_changed", null, null, actor, source, ct);
    }

    public async Task<MonitorView> AddMonitorBinding(Guid orgId, Guid projectId, Guid envId,
        FeatureFlag flag, MonitorBindingWrite write, Guid actor, string source, CancellationToken ct)
    {
        var (document, state) = await LoadMonitor(orgId, projectId, envId, flag, ct, write.ExpectedRevision);
        if (state.Current.Bindings.Count >= MaximumMonitorBindings) throw Schema.Invalid("monitor_binding_limit");
        if (state.Current.Bindings.Any(x => x.MetricId == write.MetricId)) throw Schema.Invalid("monitor_metric_already_bound");
        var metric = Read<MetricView>(await Required(projectId, "metric", write.MetricId, ct));
        if (metric.ProjectId != projectId || metric.MetricVersionId != write.MetricVersionId)
            throw Schema.Invalid("monitor_metric_version_changed");
        var now = DateTimeOffset.UtcNow;
        var rules = await MonitorRules(orgId, projectId, envId, metric, write, null, state, now, ct);
        var binding = new MonitorBindingView(Guid.NewGuid(), metric.Id, metric.MetricVersionId,
            metric.Version, now, 1, true, "environment", write.Purpose, rules, metric, now);
        await ValidateMonitorSource(projectId, envId, binding, ct);
        return await SaveMonitor(projectId, envId, flag, document, state,
            state.Current with { Bindings = state.Current.Bindings.Append(binding).ToArray() },
            "binding_added", null, binding, actor, source, ct);
    }

    public async Task<MonitorView> UpdateMonitorBinding(Guid orgId, Guid projectId, Guid envId,
        FeatureFlag flag, Guid bindingId, MonitorBindingWrite write, Guid actor, string source, CancellationToken ct)
    {
        var (document, state) = await LoadMonitor(orgId, projectId, envId, flag, ct, write.ExpectedRevision);
        var previous = FindMonitorBinding(state, bindingId);
        if (write.MetricId != previous.MetricId || write.MetricVersionId != previous.MetricVersionId)
            throw Schema.Invalid("monitor_binding_metric_immutable");
        var now = DateTimeOffset.UtcNow;
        var rules = await MonitorRules(orgId, projectId, envId, previous.Metric, write, previous, state, now, ct);
        var binding = previous with { Purpose = write.Purpose, Rules = rules };
        if (binding.Enabled) await ValidateMonitorSource(projectId, envId, binding, ct);
        if (previous.Purpose == binding.Purpose &&
            (previous.Rules ?? []).SequenceEqual(binding.Rules ?? [])) return await HydrateMonitor(projectId, envId, state.Current, ct);
        binding = binding with { Revision = previous.Revision + 1, EffectiveAt = now };
        return await SaveMonitor(projectId, envId, flag, document, state,
            ReplaceBinding(state.Current, binding), "binding_updated", previous, binding, actor, source, ct);
    }

    public async Task<MonitorView> SetMonitorBindingStatus(Guid orgId, Guid projectId, Guid envId,
        FeatureFlag flag, Guid bindingId, MonitorStatusWrite write, Guid actor, string source, CancellationToken ct)
    {
        var (document, state) = await LoadMonitor(orgId, projectId, envId, flag, ct, write.ExpectedRevision);
        var previous = FindMonitorBinding(state, bindingId);
        if (write.Enabled)
            await ValidateEnabledBinding(orgId, projectId, envId, previous, ct);
        if (previous.Enabled == write.Enabled) return await HydrateMonitor(projectId, envId, state.Current, ct);
        var binding = previous with { Enabled = write.Enabled, Revision = previous.Revision + 1, EffectiveAt = DateTimeOffset.UtcNow };
        return await SaveMonitor(projectId, envId, flag, document, state,
            ReplaceBinding(state.Current, binding), "binding_status_changed", previous, binding, actor, source, ct);
    }

    public async Task<MonitorView> RemoveMonitorBinding(Guid orgId, Guid projectId, Guid envId,
        FeatureFlag flag, Guid bindingId, long expectedRevision, Guid actor, string source, CancellationToken ct)
    {
        var (document, state) = await LoadMonitor(orgId, projectId, envId, flag, ct, expectedRevision);
        var previous = FindMonitorBinding(state, bindingId);
        return await SaveMonitor(projectId, envId, flag, document, state,
            state.Current with { Bindings = state.Current.Bindings.Where(x => x.Id != bindingId).ToArray() },
            "binding_removed", previous, null, actor, source, ct);
    }

    private static MonitorBindingView FindMonitorBinding(MonitorState state, Guid bindingId) =>
        state.Current.Bindings.SingleOrDefault(x => x.Id == bindingId) ?? throw Missing(bindingId);

    private static MonitorView ReplaceBinding(MonitorView monitor, MonitorBindingView binding) =>
        monitor with { Bindings = monitor.Bindings.Select(x => x.Id == binding.Id ? binding : x).ToArray() };

    private async Task<IReadOnlyList<MonitorRuleView>?> MonitorRules(Guid orgId, Guid projectId,
        Guid envId, MetricView metric, MonitorBindingWrite write, MonitorBindingView? previous,
        MonitorState state, DateTimeOffset now, CancellationToken ct)
    {
        if (write.Purpose == "trend") return null;
        if (write.Purpose != "guard" || write.Rules is null || write.Rules.Count is < 1 or > MaximumBindingRules)
            throw Schema.Invalid("invalid_monitor_rules");
        var ids = new HashSet<Guid>();
        var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var usedIds = state.History.SelectMany(x => new[] { x.Before, x.After })
            .Where(x => x is not null).SelectMany(x => x!.Rules ?? []).Select(x => x.Id).ToHashSet();
        var (minimum, maximum) = Schema.ResultContract(metric.ResultContract);
        var rules = new List<MonitorRuleView>();
        foreach (var writeRule in write.Rules)
        {
            if (writeRule is null) throw Schema.Invalid("invalid_monitor_rule");
            var old = previous?.Rules?.SingleOrDefault(x => x.Id == writeRule.Id);
            if (writeRule.Id == Guid.Empty || !ids.Add(writeRule.Id) ||
                (old is null && usedIds.Contains(writeRule.Id)) ||
                string.IsNullOrWhiteSpace(writeRule.Name) || writeRule.Name.Trim().Length > 80 ||
                writeRule.Name.Any(char.IsControl) || !names.Add(writeRule.Name.Trim()) ||
                writeRule.Operator is not (">" or ">=" or "<" or "<=") ||
                !double.IsFinite(writeRule.Threshold) || writeRule.Threshold < minimum || writeRule.Threshold > maximum ||
                writeRule.Severity is not ("warning" or "critical") ||
                writeRule.Reducer is not ("latest" or "average" or "minimum" or "maximum") ||
                writeRule.Lookback < 1 || writeRule.Sustain < 1 || writeRule.Recovery < 1 ||
                writeRule.EvaluationInterval < 1 || writeRule.EvaluationInterval > writeRule.Lookback ||
                writeRule.Warmup < 0 || writeRule.DataDelay < 0 || writeRule.WebhookId == Guid.Empty)
                throw Schema.Invalid("invalid_monitor_rule");
            await ValidateMonitorWebhook(orgId, projectId, envId, writeRule.WebhookId, ct);
            var rule = new MonitorRuleView(writeRule.Id, writeRule.Name.Trim(), writeRule.Operator,
                writeRule.Threshold, writeRule.Severity, writeRule.Lookback, writeRule.Reducer,
                writeRule.Sustain, writeRule.Recovery, writeRule.EvaluationInterval, writeRule.Warmup,
                writeRule.DataDelay, writeRule.WebhookId, old?.Revision ?? 1, old?.EffectiveAt ?? now);
            if (old is not null && rule != old) rule = rule with { Revision = old.Revision + 1, EffectiveAt = now };
            rules.Add(rule);
        }
        return rules;
    }

    private async Task ValidateEnabledBinding(Guid orgId, Guid projectId, Guid envId,
        MonitorBindingView binding, CancellationToken ct)
    {
        await ValidateMonitorSource(projectId, envId, binding, ct);
        foreach (var rule in binding.Rules ?? [])
            await ValidateMonitorWebhook(orgId, projectId, envId, rule.WebhookId, ct);
    }

    private async Task ValidateMonitorSource(Guid projectId, Guid envId, MonitorBindingView binding, CancellationToken ct)
    {
        if (!await MonitorSourceConnected(projectId, envId, binding.MetricVersionId, ct))
            throw Schema.Invalid("monitor_metric_not_connected");
    }

    private async Task<bool> MonitorSourceConnected(Guid projectId, Guid envId, Guid metricVersionId, CancellationToken ct)
    {
        var source = await store.FindAsync(envId, "binding", metricVersionId, ct);
        if (source is null || source.ProjectId != projectId) return false;
        var sourceBinding = Read<BindingView>(source);
        var connection = await store.FindAsync(envId, "connection", sourceBinding.ConnectionId, ct);
        if (connection is null || connection.ProjectId != projectId || sourceBinding.EnvironmentId != envId ||
            sourceBinding.MetricVersionId != metricVersionId) return false;
        var state = Read<ConnectionState>(connection);
        // A temporary provider error is not an absent source binding. Samples/connection
        // health are evaluated separately; only missing or invalidated configuration blocks use.
        return state.Revision == sourceBinding.ConnectionRevision &&
            state.ProviderType == sourceBinding.ProviderType && state.ProviderSchemaVersion == sourceBinding.ProviderSchemaVersion;
    }

    private async Task<MonitorView> HydrateMonitor(Guid projectId, Guid envId, MonitorView monitor, CancellationToken ct)
    {
        var bindings = new List<MonitorBindingView>();
        foreach (var binding in monitor.Bindings)
            bindings.Add(binding with { SourceConnected = await MonitorSourceConnected(projectId, envId, binding.MetricVersionId, ct) });
        return monitor with { Bindings = bindings };
    }

    private async Task<MonitorView> SaveMonitor(Guid projectId, Guid envId, FeatureFlag flag,
        ReleaseHealthDocument? previous, MonitorState state, MonitorView next, string operation,
        MonitorBindingView? before, MonitorBindingView? after, Guid actor, string source, CancellationToken ct)
    {
        next = next with { Revision = (previous?.Version ?? 0) + 1 };
        var history = state.History.Append(new MonitorConfigurationChange(next.Revision, after?.EffectiveAt ?? DateTimeOffset.UtcNow,
            actor, source, operation, next.Enabled, before, after)).ToArray();
        var updated = new MonitorState(next, flag.Key, flag.Name, history);
        await store.PutAsync(new(flag.Id, envId, projectId, MonitorKind, flag.Id.ToString(),
            next.Revision, Serialize(updated), null), previous?.Version, ct);
        return await HydrateMonitor(projectId, envId, next, ct);
    }
}
