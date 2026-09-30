using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;

namespace Infrastructure.UnitTests;

/// <summary>
/// Pins the health-check tag scheme introduced in the observability overhaul.
/// </summary>
/// <remarks>
/// <para>
/// The load-bearing assertion in this file is the negative one: <b>nothing tagged
/// <c>Diagnostics</c> may also carry <c>Readiness</c></b>. Readiness gates traffic, so a diagnostic
/// check that leaked into it could pull a healthy pod out of rotation because a peer datacenter or
/// a consumer group was unhappy. The overhaul's governing rule is that no existing probe's result
/// changes, and this is the test that enforces it mechanically rather than by review.
/// </para>
/// <para>
/// The second assertion is that <c>Startup</c> covers exactly the readiness set. Startup and
/// readiness ask the same question of the same dependencies and differ only in how long the
/// orchestrator waits — so a divergence between the two sets is a bug, not a design choice.
/// </para>
/// </remarks>
public class HealthCheckBuilderExtensionsTests
{
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

    private static Dictionary<string, string?> PostgresRedis() => new()
    {
        ["DbProvider"] = "Postgres",
        ["MqProvider"] = "Redis",
        ["CacheProvider"] = "Redis"
    };

    private static Dictionary<string, string?> MongoKafka() => new()
    {
        ["DbProvider"] = "MongoDb",
        ["MqProvider"] = "Kafka",
        ["CacheProvider"] = "Redis",
        ["Kafka:Producer:bootstrap.servers"] = "localhost:9092",
        ["Kafka:Consumer:bootstrap.servers"] = "localhost:9092",
        ["Kafka:Consumer:group.id"] = "featbit-api"
    };

    [Fact]
    public void AddReadinessChecks_ForEveryRegistration_AlsoCarriesTheStartupTag()
    {
        var registrations = Register(PostgresRedis());

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

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void AddDiagnosticChecks_ForEveryRegistration_NeverCarriesReadinessOrStartup(bool kafka)
    {
        var registrations = Register(kafka ? MongoKafka() : PostgresRedis());

        var leaked = registrations
            .Where(r => r.Tags.Contains(HealthCheckBuilderExtensions.DiagnosticsTag))
            .Where(r =>
                r.Tags.Contains(HealthCheckBuilderExtensions.ReadinessTag) ||
                r.Tags.Contains(HealthCheckBuilderExtensions.StartupTag))
            .Select(r => r.Name)
            .ToArray();

        // Diagnostics gate nothing. Promoting any of them is deliberately a separate decision (F3).
        Assert.Empty(leaked);
    }

    [Fact]
    public void AddDiagnosticChecks_WhenCalled_DoesNotAlterTheReadinessSet()
    {
        var settings = MongoKafka();

        var withoutDiagnostics = Register(settings, includeDiagnostics: false)
            .Where(r => r.Tags.Contains(HealthCheckBuilderExtensions.ReadinessTag))
            .Select(r => r.Name)
            .OrderBy(name => name, StringComparer.Ordinal)
            .ToArray();

        var withDiagnostics = Register(settings)
            .Where(r => r.Tags.Contains(HealthCheckBuilderExtensions.ReadinessTag))
            .Select(r => r.Name)
            .OrderBy(name => name, StringComparer.Ordinal)
            .ToArray();

        // The whole overhaul is additive. If adding diagnostics can change what readiness evaluates,
        // it is not additive, and an upgrade could flip a pod out of rotation.
        Assert.Equal(withoutDiagnostics, withDiagnostics);
    }

    [Fact]
    public void AddDiagnosticChecks_WithANonKafkaMqProvider_SkipsTheConsumerGroupProgressCheck()
    {
        var kafka = Register(MongoKafka()).Select(r => r.Name).ToArray();
        var redis = Register(PostgresRedis()).Select(r => r.Name).ToArray();

        Assert.Contains("Kafka Consumer Group Progress", kafka);
        Assert.DoesNotContain("Kafka Consumer Group Progress", redis);
    }

    [Fact]
    public void AddReadinessChecks_WithKafka_LeavesTheExistingClusterChecksOnReadiness()
    {
        var registrations = Register(MongoKafka());

        var producer = Assert.Single(registrations, r => r.Name == "Kafka Producer Cluster");
        var consumer = Assert.Single(registrations, r => r.Name == "Kafka Consumer Cluster");

        // These two are known to prove only broker reachability (both are built from a
        // ProducerConfig — see F3). They are intentionally NOT re-tagged or replaced here, because
        // changing what readiness evaluates is exactly what this effort forbids.
        Assert.Contains(HealthCheckBuilderExtensions.ReadinessTag, producer.Tags);
        Assert.Contains(HealthCheckBuilderExtensions.ReadinessTag, consumer.Tags);
        Assert.DoesNotContain(HealthCheckBuilderExtensions.DiagnosticsTag, consumer.Tags);
    }

    [Fact]
    public void Tags_AsDeclared_AreThreeDistinctValues()
    {
        // A typo collapsing two of these would silently merge probe sets, and every other assertion
        // in this file would still pass.
        string[] tags =
        [
            HealthCheckBuilderExtensions.ReadinessTag,
            HealthCheckBuilderExtensions.StartupTag,
            HealthCheckBuilderExtensions.DiagnosticsTag
        ];

        Assert.Equal(3, tags.Distinct(StringComparer.Ordinal).Count());
    }
}
