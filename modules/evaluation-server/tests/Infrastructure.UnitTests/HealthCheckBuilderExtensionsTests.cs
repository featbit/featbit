using Domain.Shared;
using Infrastructure.Store;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;

namespace Infrastructure.UnitTests;

/// <summary>
/// Pins the evaluation server's health-check tag scheme and its store-availability diagnostic.
/// </summary>
/// <remarks>
/// Kept in one class because <see cref="StoreAvailabilityListener"/> is a process-wide mutable
/// singleton — two classes setting it concurrently would read each other's value.
/// </remarks>
public class HealthCheckBuilderExtensionsTests : IDisposable
{
    private readonly string _originalAvailableStore =
        StoreAvailabilityListener.Instance.AvailableStore;

    public void Dispose() => StoreAvailabilityListener.Instance.SetAvailable(_originalAvailableStore);

    private static readonly HealthCheckContext Context = new()
    {
        Registration = new HealthCheckRegistration(
            "Store Availability",
            _ => new StoreAvailabilityHealthCheck([]),
            HealthStatus.Unhealthy,
            ["Diagnostics"])
    };

    private sealed class FakeStore(string name) : IDbStore
    {
        public string Name { get; } = name;

        public Task<bool> IsAvailableAsync() => throw new NotSupportedException();

        public Task<IEnumerable<byte[]>> GetFlagsAsync(Guid envId, long timestamp)
            => throw new NotSupportedException();

        public Task<IEnumerable<byte[]>> GetFlagsAsync(string[] ids) => throw new NotSupportedException();

        public Task<byte[]> GetSegmentAsync(string id) => throw new NotSupportedException();

        public Task<IEnumerable<byte[]>> GetSegmentsAsync(Guid envId, long timestamp)
            => throw new NotSupportedException();

        public Task<Secret?> GetSecretAsync(string secretString) => throw new NotSupportedException();
    }

    private static IReadOnlyList<HealthCheckRegistration> Register(
        Dictionary<string, string?> settings,
        bool includeDiagnostics = true)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(settings)
            .Build();

        var services = new ServiceCollection();
        services.AddLogging();

        var builder = services.AddHealthChecks().AddReadinessChecks(configuration);

        if (includeDiagnostics)
        {
            builder.AddDiagnosticChecks(configuration);
        }

        using var provider = services.BuildServiceProvider();

        return provider
            .GetRequiredService<IOptions<HealthCheckServiceOptions>>()
            .Value.Registrations
            .ToArray();
    }

    private static Dictionary<string, string?> MongoRedis() => new()
    {
        ["DbProvider"] = "MongoDb",
        ["MqProvider"] = "Redis",
        ["CacheProvider"] = "Redis"
    };

    private static Dictionary<string, string?> MongoKafka()
    {
        var settings = MongoRedis();
        settings["MqProvider"] = "Kafka";
        settings["Kafka:Producer:bootstrap.servers"] = "localhost:9092";
        settings["Kafka:Consumer:bootstrap.servers"] = "localhost:9092";
        settings["Kafka:Consumer:group.id"] = "evaluation-server";
        return settings;
    }

    [Fact]
    public void AddReadinessChecks_ForEveryRegistration_AlsoCarriesTheStartupTag()
    {
        var registrations = Register(MongoRedis());

        var readiness = registrations
            .Where(r => r.Tags.Contains(HealthCheckBuilderExtensions.ReadinessTag))
            .Select(r => r.Name)
            .OrderBy(name => name, StringComparer.Ordinal)
            .ToArray();

        var startup = registrations
            .Where(r => r.Tags.Contains(HealthCheckBuilderExtensions.StartupTag))
            .Select(r => r.Name)
            .OrderBy(name => name, StringComparer.Ordinal)
            .ToArray();

        Assert.NotEmpty(readiness);
        Assert.Equal(readiness, startup);
    }

    [Fact]
    public void AddDiagnosticChecks_ForEveryRegistration_NeverCarriesReadinessOrStartup()
    {
        var registrations = Register(MongoKafka());

        var leaked = registrations
            .Where(r => r.Tags.Contains(HealthCheckBuilderExtensions.DiagnosticsTag))
            .Where(r =>
                r.Tags.Contains(HealthCheckBuilderExtensions.ReadinessTag) ||
                r.Tags.Contains(HealthCheckBuilderExtensions.StartupTag))
            .Select(r => r.Name)
            .ToArray();

        Assert.Empty(leaked);
    }

    [Fact]
    public void AddDiagnosticChecks_WhenCalled_DoesNotAlterTheReadinessSet()
    {
        var settings = MongoKafka();

        var without = Register(settings, includeDiagnostics: false)
            .Where(r => r.Tags.Contains(HealthCheckBuilderExtensions.ReadinessTag))
            .Select(r => r.Name)
            .OrderBy(name => name, StringComparer.Ordinal)
            .ToArray();

        var with = Register(settings)
            .Where(r => r.Tags.Contains(HealthCheckBuilderExtensions.ReadinessTag))
            .Select(r => r.Name)
            .OrderBy(name => name, StringComparer.Ordinal)
            .ToArray();

        Assert.Equal(without, with);
    }

    [Fact]
    public void AddDiagnosticChecks_WithAnyProvider_RegistersTheStoreAvailabilityCheck()
    {
        // The sentinel runs on every configuration, so the check is never conditional — unlike the
        // API server's Kafka consumer-group check.
        Assert.Contains("Store Availability", Register(MongoRedis()).Select(r => r.Name));
        Assert.Contains("Store Availability", Register(MongoKafka()).Select(r => r.Name));
    }

    [Fact]
    public void AddDiagnosticChecks_WithKafka_RegistersNoConsumerGroupProgressCheck()
    {
        var names = Register(MongoKafka()).Select(r => r.Name).ToArray();

        // Deliberate: KafkaMessageConsumer mints a fresh evaluation-server-{Guid} group id per
        // process start, so reported lag would always be ~0 and would be believed. See F12.
        Assert.DoesNotContain("Kafka Consumer Group Progress", names);
    }

    [Fact]
    public async Task StoreAvailability_BeforeAnyStoreIsReported_IsUnhealthy()
    {
        StoreAvailabilityListener.Instance.SetAvailable(string.Empty);
        var sut = new StoreAvailabilityHealthCheck([new FakeStore("MongoDb")]);

        var result = await sut.CheckHealthAsync(Context);

        // Nothing has answered a probe yet. That is genuinely unknown, not healthy.
        Assert.Equal(HealthStatus.Unhealthy, result.Status);
        Assert.Equal("none", result.Data["available_store"]);
        Assert.Equal(false, result.Data["is_failed_over"]);
    }

    [Fact]
    public async Task StoreAvailability_OnThePrimaryStore_IsHealthy()
    {
        StoreAvailabilityListener.Instance.SetAvailable("MongoDb");
        var sut = new StoreAvailabilityHealthCheck([new FakeStore("Redis"), new FakeStore("MongoDb")]);

        var result = await sut.CheckHealthAsync(Context);

        // Ordinal name order, first wins — the same rule StoreAvailableSentinel applies.
        Assert.Equal(HealthStatus.Healthy, result.Status);
        Assert.Equal("MongoDb", result.Data["primary_store"]);
        Assert.Equal(false, result.Data["is_failed_over"]);
    }

    [Fact]
    public async Task StoreAvailability_OnAFallbackStore_IsDegradedNotUnhealthy()
    {
        StoreAvailabilityListener.Instance.SetAvailable("Redis");
        var sut = new StoreAvailabilityHealthCheck([new FakeStore("Redis"), new FakeStore("MongoDb")]);

        var result = await sut.CheckHealthAsync(Context);

        // The pod is still serving correctly, so this must never read as a failure — it is the
        // otherwise-invisible fact that it is serving from a fallback.
        Assert.Equal(HealthStatus.Degraded, result.Status);
        Assert.Equal(true, result.Data["is_failed_over"]);
        Assert.Equal("Redis", result.Data["available_store"]);
        Assert.Equal("MongoDb", result.Data["primary_store"]);
    }

    [Fact]
    public async Task CheckHealthAsync_ForTheStoreAvailabilityCheck_ReportsThePriorityOrderItUsed()
    {
        StoreAvailabilityListener.Instance.SetAvailable("Redis");
        var sut = new StoreAvailabilityHealthCheck([new FakeStore("Redis"), new FakeStore("MongoDb")]);

        var result = await sut.CheckHealthAsync(Context);

        // Publishing the ordering means an operator can see WHY a given store was called primary,
        // instead of having to re-derive the sentinel's rule from source.
        Assert.Equal("MongoDb,Redis", result.Data["stores_by_priority"]);
    }

    [Fact]
    public async Task StoreAvailability_WithNoStoresConfigured_IsUnhealthy()
    {
        StoreAvailabilityListener.Instance.SetAvailable(string.Empty);
        var sut = new StoreAvailabilityHealthCheck([]);

        var result = await sut.CheckHealthAsync(Context);

        Assert.Equal(HealthStatus.Unhealthy, result.Status);
        Assert.Equal("none", result.Data["primary_store"]);
    }
}
