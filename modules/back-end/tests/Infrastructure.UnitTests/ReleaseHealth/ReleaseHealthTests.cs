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
        public ReleaseHealthDocument? Document;
        public Task<IReadOnlyList<ReleaseHealthDocument>> ListAsync(Guid scope, string kind, CancellationToken ct) => Task.FromResult<IReadOnlyList<ReleaseHealthDocument>>(Document is { } doc && doc.ScopeId == scope && doc.Kind == kind ? [doc] : []);
        public Task<ReleaseHealthDocument?> FindAsync(Guid scope, string kind, Guid id, CancellationToken ct) => Task.FromResult(Document is { } doc && doc.ScopeId == scope && doc.Kind == kind && doc.Id == id ? doc : null);
        public Task PutAsync(ReleaseHealthDocument document, long? expected, CancellationToken ct)
        {
            if (Document?.Version != expected) throw new ConflictException("ReleaseHealth", document.Id);
            Document = document;
            return Task.CompletedTask;
        }
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
