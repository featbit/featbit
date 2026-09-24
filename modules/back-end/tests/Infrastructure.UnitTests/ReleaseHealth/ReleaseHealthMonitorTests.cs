using System.Linq.Expressions;
using System.Text.Json;
using Application.Bases.Exceptions;
using Application.ReleaseHealth;
using Application.Services;
using Domain.FeatureFlags;
using Domain.Projects;
using Infrastructure.ReleaseHealth;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;
using Environment = Domain.Environments.Environment;

namespace Infrastructure.UnitTests.ReleaseHealth;

public class ReleaseHealthMonitorTests
{
    [Fact]
    public async Task AddRemoveAndDeleteAllRoundTripAcrossServiceInstancesWithoutSamples()
    {
        var f = new Fixture();
        var initial = await f.Read();
        Assert.True(initial.Enabled);
        Assert.Equal(0, initial.Revision);
        Assert.Empty(initial.Bindings);
        Assert.Empty(await f.Store.ListAsync(f.Env.Id, "flag_monitor", default));

        var first = await f.Metric("first");
        var second = await f.Metric("second");
        var monitor = await f.Add(first, 0, "guard", [f.Rule()]);
        var firstId = Assert.Single(monitor.Bindings).Id;
        monitor = await f.Add(second, monitor.Revision, "trend");
        Assert.Equal(2, monitor.Bindings.Count);
        monitor = await f.Remove(firstId, monitor.Revision);
        f.Restart();
        var afterRefresh = await f.Read();
        var remaining = Assert.Single(afterRefresh.Bindings);
        Assert.Equal(second.Id, remaining.MetricId);
        Assert.Equal(monitor.Revision, afterRefresh.Revision);
        Assert.True(remaining.SourceConnected);
        Assert.Null(remaining.Rules);
        Assert.Empty(await f.Service.MonitorBindings(f.Project.Id, f.Env.Id, first.Id, default));
        var linked = Assert.Single(await f.Service.MonitorBindings(f.Project.Id, f.Env.Id, second.Id, default));
        Assert.Equal(remaining.Id, linked.Id);
        Assert.Equal(remaining.CreatedAt, linked.CreatedAt);

        await f.Remove(remaining.Id, afterRefresh.Revision);
        f.Restart();
        Assert.Empty((await f.Read()).Bindings);
        Assert.Equal(4, (await f.Read()).Revision);
        Assert.Equal(4, (await f.State()).History.Count);
    }

    [Fact]
    public async Task RuleEditsPreserveIdentityPauseAndPinnedContractWithAtomicHistory()
    {
        var f = new Fixture();
        var metric = await f.Metric();
        var firstRule = f.Rule("Errors", 3);
        var secondRule = f.Rule("Critical errors", 5) with { Severity = "warning", Sustain = 7 };
        var monitor = await f.Add(metric, 0, "guard", [firstRule, secondRule]);
        var added = Assert.Single(monitor.Bindings);
        monitor = await f.BindingStatus(added.Id, monitor.Revision, false);
        var editedRule = firstRule with { Name = "Error limit", Threshold = 8, Warmup = 2, DataDelay = 3 };
        monitor = await f.Edit(added.Id, metric, monitor.Revision, "guard", [editedRule, secondRule]);
        var edited = Assert.Single(monitor.Bindings);
        Assert.False(edited.Enabled);
        Assert.Equal(added.Id, edited.Id);
        Assert.Equal(added.CreatedAt, edited.CreatedAt);
        Assert.Equal(3, edited.Revision);
        Assert.Collection(edited.Rules!,
            r => { Assert.Equal(firstRule.Id, r.Id); Assert.Equal(2, r.Revision); Assert.Equal(8, r.Threshold); },
            r => { Assert.Equal(secondRule.Id, r.Id); Assert.Equal(1, r.Revision); Assert.Equal(7, r.Sustain); });
        Assert.All(edited.Rules!, r => Assert.Equal(f.WebhookId, r.WebhookId));

        var newMetric = await f.Service.UpdateMetric(f.Project.Id, metric.Id,
            new("Renamed current metric", metric.ResultSemantics, null, null, 0, 90, 1, 1),
            f.Actor, "UI", default);
        Assert.NotEqual(metric.MetricVersionId, newMetric.MetricVersionId);
        f.Restart();
        var persisted = Assert.Single((await f.Read()).Bindings);
        Assert.Equal(metric.MetricVersionId, persisted.Metric.MetricVersionId);
        Assert.Equal(metric.Name, persisted.Metric.Name);
        Assert.Equal(80, persisted.Metric.ResultContract.GetProperty("constraints").GetProperty("maximum").GetInt32());
        var state = await f.State();
        Assert.Equal(3, state.History.Count);
        var edit = state.History.Last();
        Assert.Equal(edited.EffectiveAt, edit.EffectiveAt);
        Assert.Equal(3, edit.Before!.Rules![0].Threshold);
        Assert.Equal(8, edit.After!.Rules![0].Threshold);
        Assert.Equal(f.Actor, edit.ActorId);
        Assert.DoesNotContain("latestCheck", JsonSerializer.Serialize(state, JsonOptions));

        monitor = await f.Edit(added.Id, metric, monitor.Revision, "trend", [editedRule]);
        Assert.Null(Assert.Single(monitor.Bindings).Rules);
        Assert.False(monitor.Bindings[0].Enabled);
        Assert.Equal(2, (await f.State()).History.Last().Before!.Rules!.Count);
    }

    [Fact]
    public async Task StaleMutationsAndFailedCasDoNotOverwriteBindingsOrHistory()
    {
        var f = new Fixture();
        var metric = await f.Metric();
        var monitor = await f.Add(metric, 0, "guard", [f.Rule()]);
        var binding = Assert.Single(monitor.Bindings);
        var stored = await f.State();
        await Assert.ThrowsAsync<ConflictException>(() => f.MonitorStatus(0, false));
        await Assert.ThrowsAsync<ConflictException>(() => f.BindingStatus(binding.Id, 0, false));
        await Assert.ThrowsAsync<ConflictException>(() => f.Edit(binding.Id, metric, 0, "trend"));
        await Assert.ThrowsAsync<ConflictException>(() => f.Remove(binding.Id, 0));
        f.Store.FailNextCas = true;
        await Assert.ThrowsAsync<ConflictException>(() => f.Remove(binding.Id, monitor.Revision));
        Assert.Equal(JsonSerializer.Serialize(stored, JsonOptions), JsonSerializer.Serialize(await f.State(), JsonOptions));
        await Assert.ThrowsAsync<BusinessException>(() => f.Add(metric, monitor.Revision, "trend"));
    }

    [Fact]
    public async Task ScopeVersionsAndSourceConnectionsAreValidatedWithoutProviderCalls()
    {
        var f = new Fixture();
        var metric = await f.Metric(connected: false);
        await Assert.ThrowsAsync<EntityNotFoundException>(() => f.Service.Monitor(Guid.NewGuid(), f.Project.Id, f.Env.Id, f.Flag, default));
        await Assert.ThrowsAsync<EntityNotFoundException>(() => f.Service.Monitor(f.OrgId, Guid.NewGuid(), f.Env.Id, f.Flag, default));
        await Assert.ThrowsAsync<EntityNotFoundException>(() => f.Service.Monitor(f.OrgId, f.Project.Id, Guid.NewGuid(), f.Flag, default));
        await Assert.ThrowsAsync<EntityNotFoundException>(() => f.Service.Monitor(f.OrgId, f.Project.Id, f.Env.Id,
            new FeatureFlag { Id = f.Flag.Id, EnvId = Guid.NewGuid() }, default));
        await Assert.ThrowsAsync<BusinessException>(() => f.Add(metric, 0, "trend"));
        var catalog = await f.Service.MonitorMetrics(f.OrgId, f.Project.Id, f.Env.Id, f.Flag, default);
        Assert.False(Assert.Single(catalog).SourceConnected);

        var monitor = await f.MonitorStatus(0, false);
        await Assert.ThrowsAsync<BusinessException>(() => f.Add(metric, monitor.Revision, "trend"));
        f.Connect(metric);
        monitor = await f.Add(metric, monitor.Revision, "trend");
        var saved = Assert.Single(monitor.Bindings);
        Assert.True(saved.SourceConnected);
        Assert.False(monitor.Enabled);
        monitor = await f.BindingStatus(saved.Id, monitor.Revision, false);
        f.Connect(metric, connectionRevision: 2);
        monitor = await f.Edit(saved.Id, metric, monitor.Revision, "guard", [f.Rule()]);
        Assert.False(monitor.Bindings[0].SourceConnected);
        await Assert.ThrowsAsync<BusinessException>(() => f.BindingStatus(saved.Id, monitor.Revision, true));
        f.Connect(metric);
        monitor = await f.BindingStatus(saved.Id, monitor.Revision, true);
        f.Connect(metric, connectionRevision: 2);
        await Assert.ThrowsAsync<BusinessException>(() => f.MonitorStatus(monitor.Revision, true));
        f.Connect(metric);
        Assert.True(Assert.Single((await f.Read()).Bindings).SourceConnected);
        monitor = await f.MonitorStatus(monitor.Revision, true);
        Assert.True(monitor.Enabled);
        f.Connect(metric, status: "unavailable");
        Assert.True(Assert.Single((await f.Read()).Bindings).SourceConnected);
        f.Connect(metric, connectionRevision: 2);
        Assert.False(Assert.Single((await f.Read()).Bindings).SourceConnected);
        await Assert.ThrowsAsync<BusinessException>(() => f.Edit(saved.Id, metric, monitor.Revision, "trend"));
        await Assert.ThrowsAsync<BusinessException>(() => f.Edit(saved.Id, metric with { MetricVersionId = Guid.NewGuid() }, monitor.Revision, "trend"));
        f.Flag.IsArchived = true;
        await Assert.ThrowsAsync<BusinessException>(() => f.Remove(saved.Id, monitor.Revision));
    }

    [Fact]
    public async Task WrongMetricProjectAndVersionAreRejectedAndFlagsRemainIsolated()
    {
        var f = new Fixture();
        var metric = await f.Metric();
        await Assert.ThrowsAsync<BusinessException>(() => f.Add(metric with { MetricVersionId = Guid.NewGuid() }, 0, "trend"));
        var otherProjectMetric = await f.Service.CreateMetric(Guid.NewGuid(), Definition("other"), default);
        await Assert.ThrowsAsync<EntityNotFoundException>(() => f.Add(otherProjectMetric, 0, "trend"));
        await f.Add(metric, 0, "trend");
        var otherFlag = new FeatureFlag { Id = Guid.NewGuid(), EnvId = f.Env.Id, Key = "another", Name = "Another" };
        var separate = await f.Service.Monitor(f.OrgId, f.Project.Id, f.Env.Id, otherFlag, default);
        Assert.Empty(separate.Bindings);
        Assert.Equal(0, separate.Revision);
    }

    [Fact]
    public async Task RejectsMalformedRulesMissingWebhooksAndRetiredRuleIdentity()
    {
        var f = new Fixture();
        var metric = await f.Metric();
        var valid = f.Rule();
        var invalid = new[]
        {
            valid with { Id = Guid.Empty }, valid with { Name = " " }, valid with { Operator = "=" },
            valid with { Threshold = double.NaN }, valid with { Threshold = double.PositiveInfinity },
            valid with { Threshold = 81 }, valid with { Threshold = -1 }, valid with { Severity = "error" },
            valid with { Reducer = "sum" }, valid with { Lookback = 0 }, valid with { Sustain = 0 },
            valid with { Recovery = 0 }, valid with { EvaluationInterval = 0 },
            valid with { EvaluationInterval = 11 }, valid with { Warmup = -1 }, valid with { DataDelay = -1 },
            valid with { WebhookId = Guid.Empty }, valid with { WebhookId = Guid.NewGuid() }
        };
        foreach (var rule in invalid)
            await Assert.ThrowsAsync<BusinessException>(() => f.Add(metric, 0, "guard", [rule]));
        await Assert.ThrowsAsync<BusinessException>(() => f.Add(metric, 0, "guard", [null!]));
        await Assert.ThrowsAsync<BusinessException>(() => f.Add(metric, 0, "guard", []));
        await Assert.ThrowsAsync<BusinessException>(() => f.Add(metric, 0, "invalid", []));
        await Assert.ThrowsAsync<BusinessException>(() => f.Add(metric, 0, "guard", [valid, valid]));
        await Assert.ThrowsAsync<BusinessException>(() => f.Add(metric, 0, "guard", [valid, valid with { Id = Guid.NewGuid(), Name = " " + valid.Name.ToUpperInvariant() + " " }]));
        var monitor = await f.Add(metric, 0, "guard", [valid]);
        var binding = Assert.Single(monitor.Bindings);
        monitor = await f.Edit(binding.Id, metric, monitor.Revision, "trend");
        await Assert.ThrowsAsync<BusinessException>(() => f.Edit(binding.Id, metric, monitor.Revision, "guard", [valid]));
    }

    [Fact]
    public void WriteContractsRejectClientEvidenceRevisionsAndUnknownFields()
    {
        var rule = new MonitorRuleWrite(Guid.NewGuid(), "Errors", ">", 3, "critical", 10, "average", 5, 5, 1, 0, 0, Guid.NewGuid());
        var json = JsonSerializer.SerializeToNode(rule, JsonOptions)!;
        json["latestCheck"] = JsonSerializer.SerializeToNode(new { healthStatus = "healthy" });
        Assert.Throws<JsonException>(() => json.Deserialize<MonitorRuleWrite>(JsonOptions));
        json.AsObject().Remove("latestCheck");
        json["revision"] = 999;
        Assert.Throws<JsonException>(() => json.Deserialize<MonitorRuleWrite>(JsonOptions));
    }

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
    private static MetricWrite Definition(string key = "errors") => new(key, "Error percentage",
        "Percentage of requests that failed during the observation period.",
        Schema.Json(new { schemaVersion = 1, resultKind = "numeric_time_series", cardinality = "single", measurementKind = "ratio",
            unit = new { kind = "percent", scale = "zero_to_one_hundred" },
            constraints = new { minimum = 0, maximum = 80, allowNaN = false, allowInfinity = false } }), FractionDigits: 2);

    private sealed class Fixture
    {
        public Guid OrgId { get; } = Guid.NewGuid();
        public Guid Actor { get; } = Guid.NewGuid();
        public Guid WebhookId { get; } = Guid.NewGuid();
        public Project Project { get; }
        public Environment Env { get; }
        public FeatureFlag Flag { get; }
        public MemoryStore Store { get; } = new();
        public ReleaseHealthService Service { get; private set; } = null!;
        public Fixture()
        {
            Project = new(OrgId, "Project", "project") { Id = Guid.NewGuid() };
            Env = new(Project.Id, "Production", "prod");
            Flag = new() { Id = Guid.NewGuid(), EnvId = Env.Id, Key = "checkout", Name = "Checkout" };
            Store.Seed(new(WebhookId, OrgId, OrgId, "monitor_alert_webhook", WebhookId.ToString(), 1,
                Schema.Json(new { purpose = "release-health", name = "Ops", url = "https://example.com/alerts", isActive = true,
                    scopes = new[] { $"{Project.Id}/{Env.Id}" }, scopeNames = new[] { "Project/Prod" }, payloadTemplateType = "custom",
                    payloadTemplate = "{}", hasHeaders = false, hasSecret = false, createdAt = DateTimeOffset.UtcNow,
                    updatedAt = DateTimeOffset.UtcNow, updatedBy = Actor, isDeleted = false }).GetRawText(), null));
            Restart();
        }
        public void Restart()
        {
            var projects = new Mock<IProjectService>();
            projects.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<Project, bool>>>()))
                .Returns((Expression<Func<Project, bool>> predicate) => Task.FromResult(predicate.Compile()(Project) ? Project : null));
            var envs = new Mock<IEnvironmentService>();
            envs.Setup(x => x.AnyAsync(It.IsAny<Expression<Func<Environment, bool>>>()))
                .Returns((Expression<Func<Environment, bool>> predicate) => Task.FromResult(predicate.Compile()(Env)));
            Service = new(Store, Mock.Of<ICredentialProtector>(), [], envs.Object, projects.Object, NullLogger<ReleaseHealthService>.Instance);
        }
        public async Task<MetricView> Metric(string key = "errors", bool connected = true)
        {
            var metric = await Service.CreateMetric(Project.Id, Definition(key), default);
            if (connected) Connect(metric);
            return metric;
        }
        public void Connect(MetricView metric, int connectionRevision = 1, string status = "connected")
        {
            var id = Guid.NewGuid();
            Store.Seed(new(id, Env.Id, Project.Id, "connection", id.ToString(), 1,
                Schema.Json(new { name = "Prometheus", providerType = "prometheus-compatible", providerSchemaVersion = 1,
                    providerConfig = new { endpoint = "https://example.com" }, authentication = new { type = "none" },
                    revision = connectionRevision, lastCheckedAt = DateTimeOffset.UtcNow, status }).GetRawText(), null));
            var source = new BindingView(metric.MetricVersionId, Env.Id, metric.MetricVersionId, id, 1,
                "prometheus-compatible", 1, Schema.Json(new { promql = "sum(up)", step = "1m", queryMode = "range" }), 1, DateTimeOffset.UtcNow);
            Store.Seed(new(source.Id, Env.Id, Project.Id, "binding", source.Id.ToString(), 1, JsonSerializer.Serialize(source, JsonOptions), null));
        }
        public MonitorRuleWrite Rule(string name = "Errors", double threshold = 3) =>
            new(Guid.NewGuid(), name, ">", threshold, "critical", 10, "average", 5, 5, 1, 0, 0, WebhookId);
        public Task<MonitorView> Read() => Service.Monitor(OrgId, Project.Id, Env.Id, Flag, default);
        public Task<MonitorView> Add(MetricView metric, long revision, string purpose, IReadOnlyList<MonitorRuleWrite>? rules = null) =>
            Service.AddMonitorBinding(OrgId, Project.Id, Env.Id, Flag, new(revision, metric.Id, metric.MetricVersionId, purpose, rules), Actor, "UI", default);
        public Task<MonitorView> Edit(Guid id, MetricView metric, long revision, string purpose, IReadOnlyList<MonitorRuleWrite>? rules = null) =>
            Service.UpdateMonitorBinding(OrgId, Project.Id, Env.Id, Flag, id, new(revision, metric.Id, metric.MetricVersionId, purpose, rules), Actor, "UI", default);
        public Task<MonitorView> Remove(Guid id, long revision) => Service.RemoveMonitorBinding(OrgId, Project.Id, Env.Id, Flag, id, revision, Actor, "UI", default);
        public Task<MonitorView> MonitorStatus(long revision, bool enabled) => Service.SetMonitorStatus(OrgId, Project.Id, Env.Id, Flag, new(revision, enabled), Actor, "UI", default);
        public Task<MonitorView> BindingStatus(Guid id, long revision, bool enabled) => Service.SetMonitorBindingStatus(OrgId, Project.Id, Env.Id, Flag, id, new(revision, enabled), Actor, "UI", default);
        public async Task<MonitorState> State() => JsonSerializer.Deserialize<MonitorState>(
            (await Store.FindAsync(Env.Id, "flag_monitor", Flag.Id, default))!.Payload, JsonOptions)!;
    }

    private sealed class MemoryStore : IReleaseHealthStore
    {
        private readonly Dictionary<(Guid Scope, string Kind, Guid Id), ReleaseHealthDocument> documents = [];
        public bool FailNextCas { get; set; }
        public void Seed(ReleaseHealthDocument document) => documents[(document.ScopeId, document.Kind, document.Id)] = document;
        public Task<IReadOnlyList<ReleaseHealthDocument>> ListAsync(Guid scope, string kind, CancellationToken ct) =>
            Task.FromResult<IReadOnlyList<ReleaseHealthDocument>>(documents.Values.Where(x => x.ScopeId == scope && x.Kind == kind).ToArray());
        public Task<ReleaseHealthDocument?> FindAsync(Guid scope, string kind, Guid id, CancellationToken ct) =>
            Task.FromResult(documents.GetValueOrDefault((scope, kind, id)));
        public Task PutAsync(ReleaseHealthDocument document, long? expected, CancellationToken ct)
        {
            if (FailNextCas || documents.GetValueOrDefault((document.ScopeId, document.Kind, document.Id))?.Version != expected)
            {
                FailNextCas = false;
                throw new ConflictException("ReleaseHealthMonitor", document.Id);
            }
            Seed(document);
            return Task.CompletedTask;
        }
    }
}
