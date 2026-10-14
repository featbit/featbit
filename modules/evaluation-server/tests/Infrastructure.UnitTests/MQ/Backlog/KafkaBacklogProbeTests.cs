using Confluent.Kafka;
using Domain.Messages;
using Domain.Observability;
using Infrastructure.MQ.Backlog;
using Infrastructure.MQ.Kafka;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace Infrastructure.UnitTests.MQ.Backlog;

/// <summary>
/// Pins the scope of the evaluation server's backlog sampling.
/// </summary>
/// <remarks>
/// Kafka is the only transport here with a measurable backlog, and the omissions are deliberate
/// rather than unfinished: the Postgres consumer uses LISTEN/NOTIFY, so there is no queue table to
/// count, and the Redis consumer uses a pub/sub subscription, where an undelivered message is
/// discarded rather than queued. A gauge reporting a permanent zero for either would read as
/// "healthy and drained", which is worse than reporting nothing.
/// </remarks>
public class KafkaBacklogProbeTests
{
    [Fact]
    public void Topics_MatchTheTopicsTheConsumerSubscribesTo()
    {
        // Arrange
        var configuration = Build(useControlPlane: false);

        // Act
        var probe = new KafkaBacklogProbe(CreateReader(configuration));

        // Assert
        Assert.Equal([Topics.FeatureFlagChange, Topics.SegmentChange], probe.Topics);
    }

    [Fact]
    public void Topics_BehindAControlPlane_IncludeTheCommandTopic()
    {
        // Arrange
        var configuration = Build(useControlPlane: true);

        // Act
        var probe = new KafkaBacklogProbe(CreateReader(configuration));

        // Assert
        Assert.Equal(
            [Topics.FeatureFlagChange, Topics.SegmentChange, Topics.ControlPlaneCommand],
            probe.Topics);
    }

    [Fact]
    public void Provider_IsTheKafkaMessagingSystem()
    {
        // Arrange & Act
        var probe = new KafkaBacklogProbe(CreateReader(Build(useControlPlane: false)));

        // Assert
        Assert.Equal(MessagingSystems.Kafka, probe.Provider);
    }

    [Fact]
    public async Task SampleAsync_WithNoConfiguredGroup_ReportsEveryTopicAsUnknown()
    {
        // Arrange
        var probe = new KafkaBacklogProbe(CreateReader(Build(useControlPlane: false)));

        // Act
        var sampled = await probe.SampleAsync(CancellationToken.None);

        // Assert
        // An empty result means "unknown" for every topic, which is the truth when there is no
        // group whose progress could be read — and it must not touch a broker to find that out.
        Assert.Empty(sampled);
    }

    [Fact]
    public void GroupId_IsReadLazilyFromTheLiveConfig()
    {
        // Arrange
        var config = new ConsumerConfig();
        var reader = new KafkaLagReader(config, Build(useControlPlane: false), NullLogger<KafkaLagReader>.Instance);
        Assert.False(reader.IsConfigured);

        // Act
        // This service assigns its group id onto the shared ConsumerConfig when its consumer is
        // constructed, which may happen after this reader.
        config.GroupId = "evaluation-server-later";

        // Assert
        Assert.True(reader.IsConfigured);
        Assert.Equal("evaluation-server-later", reader.GroupId);
    }

    private static KafkaLagReader CreateReader(IConfiguration configuration)
        => new(new ConsumerConfig(), configuration, NullLogger<KafkaLagReader>.Instance);

    private static IConfiguration Build(bool useControlPlane)
        => new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ControlPlane:Enabled"] = useControlPlane ? "true" : "false"
            })
            .Build();
}
