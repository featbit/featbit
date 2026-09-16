using System.Security.Cryptography;
using System.Text.Json;
using Application.Bases.Exceptions;
using Application.ReleaseHealth;
using Application.Services;
using Infrastructure.ReleaseHealth;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Moq;
using Xunit;

namespace Infrastructure.UnitTests.ReleaseHealth;

public class ReleaseHealthTests
{
    private static IConfigurationRoot Configuration() => new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
    {
        ["ReleaseHealth:Credentials:ActiveKeyId"] = "key1",
        ["ReleaseHealth:Credentials:Keys:key1"] = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)),
        ["ReleaseHealth:Credentials:Keys:key2"] = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)),
        ["ReleaseHealth:Development:AllowedLoopbackOrigins:0"] = "http://127.0.0.1:19181"
    }).Build();
    private static PrometheusProvider Provider(string environment = "Development")
    {
        var host = new Mock<IHostEnvironment>();
        host.SetupGet(x => x.EnvironmentName).Returns(environment);
        return new(Configuration(), host.Object);
    }
    private static ConnectionWrite Write(string auth = "bearer_token", object? secret = null) => new("Test", "prometheus-compatible", 1,
        Schema.Json(new { endpoint = "http://127.0.0.1:19181/bearer" }),
        auth == "basic" ? Schema.Json(new { type = auth, username = "reader" }) : Schema.Json(new { type = auth }),
        Schema.Json(secret ?? new { operation = "replace", token = "fixture-token" }), null);

    [Fact]
    public void EncryptionUsesRandomNoncesAndBindsEnvironmentAndConnection()
    {
        var protector = new AesCredentialProtector(Configuration());
        var first = protector.Protect("test-secret", "project:env:connection:provider");
        var second = protector.Protect("test-secret", "project:env:connection:provider");
        Assert.NotEqual(first, second);
        Assert.DoesNotContain("test-secret", first);
        Assert.Equal("test-secret", protector.Unprotect(first, "project:env:connection:provider"));
        Assert.Throws<BusinessException>(() => protector.Unprotect(first, "project:other-env:connection:provider"));
        var data = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(first)!;
        data["Tag"] = Schema.Json(Convert.ToBase64String(new byte[16]));
        Assert.Throws<BusinessException>(() => protector.Unprotect(JsonSerializer.Serialize(data), "project:env:connection:provider"));
    }
    [Fact]
    public void RotationReadsOldEnvelopesAndMissingKeyFailsClosed()
    {
        var config = Configuration();
        var protector = new AesCredentialProtector(config);
        var old = protector.Protect("secret", "context");
        config["ReleaseHealth:Credentials:ActiveKeyId"] = "key2";
        Assert.Equal("secret", protector.Unprotect(old, "context"));
        Assert.Contains("key2", protector.Protect("secret", "context"));
        config["ReleaseHealth:Credentials:Keys:key1"] = null;
        Assert.Throws<BusinessException>(() => protector.Unprotect(old, "context"));
        config["ReleaseHealth:Credentials:Keys:key2"] = "not-a-key";
        Assert.Throws<BusinessException>(() => protector.Protect("secret", "context"));
    }
    [Theory]
    [InlineData("http://127.0.0.1:9999")]
    [InlineData("http://169.254.169.254")]
    [InlineData("https://user:password@example.com")]
    [InlineData("https://example.com?token=secret")]
    [InlineData("https://example.com#fragment")]
    [InlineData("file:///tmp/secret")]
    public void RejectsUnsafeEndpointShapes(string endpoint) => Assert.Throws<BusinessException>(() => Provider().Endpoint(endpoint));
    [Fact]
    public void LocalHttpExceptionCannotBeUsedInProduction() => Assert.Throws<BusinessException>(() => Provider("Production").Endpoint("http://127.0.0.1:19181/none"));
    [Fact]
    public void PrometheusCredentialsAreTypedWriteOnlyAndCannotBeKeptAcrossAuthTypes()
    {
        var provider = Provider();
        var token = provider.Validate(Write(), null);
        Assert.DoesNotContain("fixture-token", provider.ReadAuthentication(token, DateTimeOffset.UtcNow).GetRawText());
        var keep = provider.Validate(Write(secret: new { operation = "keep" }), token);
        Assert.Equal("fixture-token", keep.Secrets["token"]);
        Assert.Throws<BusinessException>(() => provider.Validate(Write("basic", new { operation = "keep" }), token));
        Assert.Throws<BusinessException>(() => provider.Validate(Write(secret: new { operation = "replace", token = "value", secretReference = "other-env" }), token));
        Assert.Throws<BusinessException>(() => provider.Validate(Write() with { Authentication = Schema.Json(new { type = "bearer_token", username = "wrong-branch" }) }, null));
        var none = provider.Validate(Write("none", new { operation = "remove" }), token);
        Assert.Empty(none.Secrets);
        Assert.Throws<BusinessException>(() => provider.Validate(Write("none"), token));
    }
    [Theory]
    [InlineData("NaN")]
    [InlineData("+Inf")]
    [InlineData("text")]
    public void RejectsNonFiniteResults(string value)
    {
        var response = Schema.Json(new { data = new { resultType = "matrix", result = new[] { new { values = new object[][] { [1000, value] } } } } });
        Assert.Throws<BusinessException>(() => PrometheusProvider.ParseRange(response, DateTimeOffset.FromUnixTimeSeconds(900), DateTimeOffset.FromUnixTimeSeconds(1100)));
    }
    [Fact]
    public void EmptyResultIsNotZeroAndMultipleSeriesAreRejected()
    {
        var start = DateTimeOffset.FromUnixTimeSeconds(900);
        var end = DateTimeOffset.FromUnixTimeSeconds(1100);
        Assert.Empty(PrometheusProvider.ParseRange(Schema.Json(new { data = new { resultType = "matrix", result = Array.Empty<object>() } }), start, end));
        var response = Schema.Json(new { data = new { resultType = "matrix", result = new[] { new { values = new object[][] { [1000, "1"] } }, new { values = new object[][] { [1000, "2"] } } } } });
        Assert.Throws<BusinessException>(() => PrometheusProvider.ParseRange(response, start, end));
    }
    [Fact]
    public void ResultContractRejectsInvalidProfilesAndCannotWidenUnitBounds()
    {
        var contract = new { schemaVersion = 1, resultKind = "numeric_time_series", cardinality = "single", measurementKind = "ratio", unit = new { kind = "percent", scale = "zero_to_one_hundred" }, constraints = new { minimum = 0, maximum = 100, allowNaN = false, allowInfinity = false } };
        Assert.Equal((0d, 100d), Schema.ResultContract(Schema.Json(contract)));
        Assert.Throws<BusinessException>(() => Schema.ResultContract(Schema.Json(contract with { measurementKind = "count" })));
        Assert.Throws<BusinessException>(() => Schema.ResultContract(Schema.Json(contract with { constraints = contract.constraints with { maximum = 200 } })));
    }

    private static MetricWrite MetricDefinition() => new("checkout_ratio", "Checkout ratio", "Percentage of failed checkout requests in the query window.",
        Schema.Json(new { schemaVersion = 1, resultKind = "numeric_time_series", cardinality = "single", measurementKind = "ratio",
            unit = new { kind = "percent", scale = "zero_to_one_hundred" }, constraints = new { minimum = 0, maximum = 80, allowNaN = false, allowInfinity = false } }),
        "Checkout reliability", "reliability", 3);

    [Fact]
    public async Task MetricDefinitionRoundTripsAllDrawerFieldsWithoutCreatingAnEnvironmentBinding()
    {
        var store = new MemoryStore();
        var service = Service(store, Configuration(), out _);
        var project = Guid.NewGuid();
        var saved = await service.CreateMetric(project, MetricDefinition(), default);
        var read = Assert.Single(await service.Metrics(project, default));
        Assert.Equal(saved.Id, read.Id);
        Assert.Equal(saved.MetricVersionId, read.MetricVersionId);
        Assert.Equal(saved.ResultContract.GetRawText(), read.ResultContract.GetRawText());
        Assert.Equal("Checkout reliability", read.Description);
        Assert.Equal("reliability", read.Category);
        Assert.Equal(3, read.FractionDigits);
        Assert.Equal(1, read.Version);
        Assert.Equal(80, read.ResultContract.GetProperty("constraints").GetProperty("maximum").GetInt32());
        Assert.Empty(await service.Metrics(Guid.NewGuid(), default));
        Assert.Null(await service.Binding(project, Guid.NewGuid(), saved.Id, default));
    }

    [Theory]
    [InlineData("invalid-key", "reliability", 2)]
    [InlineData("valid_key", "unknown", 2)]
    [InlineData("valid_key", "quality", 5)]
    public async Task MetricDefinitionRejectsInvalidKeyCategoryAndPrecision(string key, string category, int digits)
    {
        var service = Service(new MemoryStore(), Configuration(), out _);
        await Assert.ThrowsAsync<BusinessException>(() => service.CreateMetric(Guid.NewGuid(), MetricDefinition() with { Key = key, Category = category, FractionDigits = digits }, default));
    }

    [Fact]
    public void ExistingMetricDocumentsWithoutOptionalMetadataRemainReadable()
    {
        var legacy = Schema.Json(new { id = Guid.NewGuid(), projectId = Guid.NewGuid(), metricVersionId = Guid.NewGuid(), version = 1,
            key = "legacy_metric", name = "Legacy metric", resultSemantics = "Legacy metric semantics.", resultContract = MetricDefinition().ResultContract });
        var read = legacy.Deserialize<MetricView>(new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
        Assert.Null(read.Description);
        Assert.Null(read.Category);
        Assert.Null(read.FractionDigits);
    }

    private sealed class MemoryStore : IReleaseHealthStore
    {
        private readonly Dictionary<(Guid Scope, string Kind, Guid Id), ReleaseHealthDocument> documents = [];
        private ReleaseHealthDocument? document;
        public ReleaseHealthDocument? Document
        {
            get => document;
            set { document = value; if (value is not null) documents[(value.ScopeId, value.Kind, value.Id)] = value; }
        }
        public Task<IReadOnlyList<ReleaseHealthDocument>> ListAsync(Guid scope, string kind, CancellationToken ct) =>
            Task.FromResult<IReadOnlyList<ReleaseHealthDocument>>(documents.Values.Where(x => x.ScopeId == scope && x.Kind == kind).ToArray());
        public Task<ReleaseHealthDocument?> FindAsync(Guid scope, string kind, Guid id, CancellationToken ct) =>
            Task.FromResult(documents.GetValueOrDefault((scope, kind, id)));
        public Task PutAsync(ReleaseHealthDocument value, long? expected, CancellationToken ct)
        {
            if (documents.GetValueOrDefault((value.ScopeId, value.Kind, value.Id))?.Version != expected)
                throw new ConflictException("ReleaseHealth", value.Id);
            Document = value;
            return Task.CompletedTask;
        }
    }

    private static MetricUpdateWrite Edit(MetricView metric) => new(metric.Name, metric.ResultSemantics,
        metric.Description, metric.Category, 0, 80, metric.FractionDigits ?? 2, metric.Revision);

    [Fact]
    public async Task MetadataAndDisplayEditsKeepVersionAndRecordProjectAudit()
    {
        var store = new MemoryStore();
        var service = Service(store, Configuration(), out _);
        var project = Guid.NewGuid();
        var metric = await service.CreateMetric(project, MetricDefinition(), default);
        var changed = await service.UpdateMetric(project, metric.Id, Edit(metric) with { Name = "New name", FractionDigits = 1 }, Guid.NewGuid(), "UI", default);
        Assert.Equal(metric.MetricVersionId, changed.MetricVersionId);
        Assert.Equal(1, changed.Version);
        Assert.Equal(2, changed.Revision);
        var events = await service.Changes(project, Guid.NewGuid(), metric.Id, DateTimeOffset.UtcNow.AddHours(-1), DateTimeOffset.UtcNow.AddSeconds(1), default);
        var audit = Assert.Single(events);
        Assert.Null(audit.EnvironmentId);
        Assert.Equal("UI", audit.Source);
        Assert.Contains(audit.Fields, x => x.Field == "fractionDigits" && x.Before == "3" && x.After == "1");
        await Assert.ThrowsAsync<ConflictException>(() => service.UpdateMetric(project, metric.Id, Edit(metric), Guid.NewGuid(), "API", default));
    }

    [Fact]
    public async Task ContractChangesRequireANewEnvironmentBindingAndPreserveOldContract()
    {
        var store = new MemoryStore();
        var service = Service(store, Configuration(), out var provider);
        provider.Setup(x => x.ValidateBinding(It.IsAny<JsonElement>())).Returns((JsonElement config) => config);
        provider.Setup(x => x.QueryAsync(It.IsAny<ProviderConnection>(), It.IsAny<JsonElement>(), It.IsAny<DateTimeOffset>(), It.IsAny<DateTimeOffset>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync([new MetricPoint(DateTimeOffset.UtcNow.AddSeconds(-10), 1)]);
        var project = Guid.NewGuid(); var env = Guid.NewGuid(); var actor = Guid.NewGuid();
        var metric = await service.CreateMetric(project, MetricDefinition(), default);
        var connection = (await service.TestOrSave(project, env, null, Write(), actor, true, default))!;
        var config = Schema.Json(new { promql = "sum(up)", step = "5s", queryMode = "range" });
        await service.PreviewOrSaveBinding(project, env, metric.Id, new(connection.Id, connection.Revision, connection.ProviderType, 1, config, null), true, actor, default);
        Assert.NotNull(await service.Binding(project, env, metric.Id, default));
        var changed = await service.UpdateMetric(project, metric.Id, Edit(metric) with { Maximum = 90 }, actor, "API", default);
        Assert.Equal(2, changed.Version);
        Assert.NotEqual(metric.MetricVersionId, changed.MetricVersionId);
        Assert.Null(await service.Binding(project, env, metric.Id, default));
        Assert.NotNull(await store.FindAsync(env, "binding", metric.MetricVersionId, default));
        var old = await store.FindAsync(project, "metric_version", metric.MetricVersionId, default);
        Assert.Contains("80", old!.Payload);
        var prodEvents = await service.Changes(project, env, metric.Id, DateTimeOffset.UtcNow.AddHours(-1), DateTimeOffset.UtcNow.AddSeconds(1), default);
        Assert.Equal(2, prodEvents.Count);
        Assert.DoesNotContain("sum(up)", JsonSerializer.Serialize(prodEvents));
        var otherEnv = await service.Changes(project, Guid.NewGuid(), metric.Id, DateTimeOffset.UtcNow.AddHours(-1), DateTimeOffset.UtcNow.AddSeconds(1), default);
        Assert.Equal("metric", Assert.Single(otherEnv).Kind);
    }

    [Theory]
    [InlineData("5s", 5)]
    [InlineData("15s", 15)]
    [InlineData("1m", 60)]
    [InlineData("5m", 300)]
    [InlineData("15m", 900)]
    public async Task TrendRangeUsesCurrentStepAcrossHistoricalQueriesWithoutChangingSavedRevisions(string step, int seconds)
    {
        var store = new MemoryStore();
        var service = Service(store, Configuration(), out var provider);
        var requests = new List<(string Query, string Step, DateTimeOffset Start, DateTimeOffset End)>();
        provider.Setup(x => x.ValidateBinding(It.IsAny<JsonElement>())).Returns((JsonElement config) => config);
        provider.Setup(x => x.QueryAsync(It.IsAny<ProviderConnection>(), It.IsAny<JsonElement>(), It.IsAny<DateTimeOffset>(), It.IsAny<DateTimeOffset>(), It.IsAny<CancellationToken>()))
            .Returns((ProviderConnection _, JsonElement config, DateTimeOffset start, DateTimeOffset end, CancellationToken _) =>
            {
                var query = Schema.Text(config, "promql");
                var interval = Schema.Text(config, "step");
                requests.Add((query, interval, start, end));
                var width = int.Parse(interval[..^1]) * (interval.EndsWith('m') ? 60 : 1);
                IReadOnlyList<MetricPoint> points = Enumerable.Range(0, (int)((end - start).TotalSeconds / width) + 1)
                    .Select(index => new MetricPoint(start.AddSeconds(index * width), query == "sum(up)" ? 10 : 20)).ToArray();
                return Task.FromResult(points);
            });
        var project = Guid.NewGuid(); var env = Guid.NewGuid(); var actor = Guid.NewGuid();
        var metric = await service.CreateMetric(project, MetricDefinition(), default);
        var connection = (await service.TestOrSave(project, env, null, Write(), actor, true, default))!;
        var to = DateTimeOffset.FromUnixTimeSeconds(DateTimeOffset.UtcNow.AddMinutes(-1).ToUnixTimeSeconds());
        var from = to.AddHours(-1);
        var changedAt = from.AddMinutes(30);
        async Task SaveBinding(string query, string interval, long? expected, DateTimeOffset effectiveAt)
        {
            var config = Schema.Json(new { promql = query, step = interval, queryMode = "range" });
            await service.PreviewOrSaveBinding(project, env, metric.Id,
                new(connection.Id, connection.Revision, connection.ProviderType, 1, config, expected), true, actor, default);
            var binding = (await service.Binding(project, env, metric.Id, default))!;
            var document = (await store.FindAsync(env, "binding", metric.MetricVersionId, default))!;
            store.Document = document with { Payload = Schema.Json(binding with { ValidatedAt = effectiveAt }).GetRawText() };
        }
        await SaveBinding("sum(up)", step == "15m" ? "1m" : "15m", null, from.AddHours(-1));
        await SaveBinding("sum(errors)", step, 1, changedAt);
        var savedHistory = Assert.Single(await store.ListAsync(env, "binding_revision", default));
        var savedCurrent = await store.FindAsync(env, "binding", metric.MetricVersionId, default);
        var savedAudit = await service.Changes(project, env, metric.Id, from, DateTimeOffset.UtcNow.AddSeconds(1), default);
        requests.Clear();

        var trend = await service.TrendRange(project, env, metric.Id, from, to, default);

        Assert.Equal(Enumerable.Range(0, 3600 / seconds + 1).Select(index => from.AddSeconds(index * seconds)),
            trend.Points.Select(point => point.Timestamp));
        Assert.Collection(requests,
            request => Assert.Equal(("sum(up)", step, from, changedAt), request),
            request => Assert.Equal(("sum(errors)", step, changedAt, to), request));
        Assert.All(trend.Points, point =>
        {
            Assert.Equal(point.Timestamp < changedAt ? 10d : 20d, point.Value);
            Assert.Equal(point.Timestamp < changedAt ? 1L : 2L, point.SourceBindingRevision);
        });

        // A wholly historical range also uses the current browsing resolution.
        requests.Clear();
        var historical = await service.TrendRange(project, env, metric.Id, from, from.AddMinutes(15), default);
        Assert.Equal(900 / seconds + 1, historical.Points.Count);
        Assert.Equal(("sum(up)", step, from, from.AddMinutes(15)), Assert.Single(requests));
        var boundary = await service.TrendRange(project, env, metric.Id, from, changedAt, default);
        Assert.Equal(1800 / seconds + 1, boundary.Points.Count);
        Assert.Equal(new MetricPoint(changedAt, 20, 2), boundary.Points.Last());
        Assert.Equal(savedHistory, Assert.Single(await store.ListAsync(env, "binding_revision", default)));
        Assert.Equal(savedCurrent, await store.FindAsync(env, "binding", metric.MetricVersionId, default));
        Assert.Equal(savedAudit.Select(x => Schema.Json(x).GetRawText()),
            (await service.Changes(project, env, metric.Id, from, DateTimeOffset.UtcNow.AddSeconds(1), default))
                .Select(x => Schema.Json(x).GetRawText()));
    }

    [Fact]
    public async Task ContractBoundsCannotWidenUnitRangeAndNoopDoesNotCreateAnAuditEvent()
    {
        var service = Service(new MemoryStore(), Configuration(), out _);
        var project = Guid.NewGuid();
        var metric = await service.CreateMetric(project, MetricDefinition(), default);
        await Assert.ThrowsAsync<BusinessException>(() => service.UpdateMetric(project, metric.Id, Edit(metric) with { Maximum = 101 }, Guid.NewGuid(), "UI", default));
        var saved = await service.UpdateMetric(project, metric.Id, Edit(metric), Guid.NewGuid(), "UI", default);
        Assert.Equal(1, saved.Version);
        Assert.Empty(await service.Changes(project, Guid.NewGuid(), metric.Id, DateTimeOffset.UtcNow.AddHours(-1), DateTimeOffset.UtcNow.AddSeconds(1), default));
        Assert.Throws<BusinessException>(() => ReleaseHealthService.ValidateRange(DateTimeOffset.UtcNow.AddDays(-8), DateTimeOffset.UtcNow));
    }

    private static ReleaseHealthService Service(MemoryStore store, IConfiguration config, out Mock<IMetricSourceProvider> adapter)
    {
        var real = Provider();
        adapter = new Mock<IMetricSourceProvider>(MockBehavior.Strict);
        adapter.SetupGet(x => x.Type).Returns(real.Type);
        adapter.SetupGet(x => x.SchemaVersion).Returns(real.SchemaVersion);
        adapter.Setup(x => x.Validate(It.IsAny<ConnectionWrite>(), It.IsAny<ProviderConnection?>())).Returns((ConnectionWrite w, ProviderConnection? previous) => real.Validate(w, previous));
        adapter.Setup(x => x.ReadAuthentication(It.IsAny<ProviderConnection>(), It.IsAny<DateTimeOffset?>())).Returns((ProviderConnection c, DateTimeOffset? rotated) => real.ReadAuthentication(c, rotated));
        adapter.Setup(x => x.TestAsync(It.IsAny<ProviderConnection>(), It.IsAny<CancellationToken>())).Returns(Task.CompletedTask);
        return new(store, new AesCredentialProtector(config), [adapter.Object], Mock.Of<IEnvironmentService>(), Mock.Of<IProjectService>(), NullLogger<ReleaseHealthService>.Instance);
    }
    [Theory]
    [InlineData("/bearer", "/retargeted")]
    [InlineData("reader", "another-user")]
    public async Task DatabaseMetadataTamperingCannotRetargetStoredCredential(string from, string to)
    {
        var store = new MemoryStore();
        var service = Service(store, Configuration(), out var adapter);
        var env = Guid.NewGuid();
        var saved = await service.TestOrSave(Guid.NewGuid(), env, null, Write("basic", new { operation = "replace", password = "fixture-password" }), Guid.NewGuid(), true, default);
        store.Document = store.Document! with { Payload = store.Document.Payload.Replace(from, to, StringComparison.Ordinal) };
        Assert.Single(await service.Connections(env, default)); // read metadata never decrypts
        await Assert.ThrowsAsync<BusinessException>(() => service.TestSaved(env, saved!.Id, Guid.NewGuid(), default));
        adapter.Verify(x => x.TestAsync(It.IsAny<ProviderConnection>(), It.IsAny<CancellationToken>()), Times.Once);
        Assert.Equal("unavailable", (await service.Connections(env, default))[0].Status);
    }
    [Fact]
    public async Task AuthorizedReplacementRecoversFromLostOldKeyWithoutReadingOldSecret()
    {
        var config = Configuration();
        var store = new MemoryStore();
        var service = Service(store, config, out _);
        var project = Guid.NewGuid();
        var env = Guid.NewGuid();
        var saved = (await service.TestOrSave(project, env, null, Write(), Guid.NewGuid(), true, default))!;
        config["ReleaseHealth:Credentials:ActiveKeyId"] = "key2";
        config["ReleaseHealth:Credentials:Keys:key1"] = null;
        var keep = Write(secret: new { operation = "keep" }) with { ExpectedVersion = saved.Version };
        await Assert.ThrowsAsync<BusinessException>(() => service.TestOrSave(project, env, saved.Id, keep, Guid.NewGuid(), true, default));
        var replaced = (await service.TestOrSave(project, env, saved.Id, Write() with { ExpectedVersion = saved.Version }, Guid.NewGuid(), true, default))!;
        Assert.Equal(saved.Revision, replaced.Revision);
        Assert.Equal(saved.Version + 1, replaced.Version);
        Assert.Contains("key2", store.Document!.ProtectedSecrets);
        await service.TestSaved(env, saved.Id, Guid.NewGuid(), default);
        Assert.Empty(await service.Connections(Guid.NewGuid(), default));
    }
}
