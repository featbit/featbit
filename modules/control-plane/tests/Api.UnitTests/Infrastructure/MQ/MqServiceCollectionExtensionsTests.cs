using Api.Infrastructure.MQ;
using Microsoft.Extensions.Configuration;

namespace Api.UnitTests.Infrastructure.MQ;

/// <summary>
/// #100 unit coverage for <see cref="MqServiceCollectionExtensions.ResolveConsumerGroupId"/>: the
/// pure helper that suffixes the shipped default Kafka consumer group.id with the local DC
/// identity so two control planes sharing a Kafka broker don't collide on a single static
/// group.id (only one DC would process flag/segment changes and heartbeats while the other
/// silently idles). Exercised directly (no DI / real Kafka needed).
/// </summary>
public class MqServiceCollectionExtensionsTests
{
    private static IConfiguration CreateConfiguration(string? dcId)
    {
        var data = new Dictionary<string, string?>();
        if (dcId != null)
        {
            data["Redis:Instances:0:DcId"] = dcId;
        }

        return new ConfigurationBuilder()
            .AddInMemoryCollection(data)
            .Build();
    }

    [Fact]
    public void DefaultGroupId_WithDcId_IsSuffixedWithDcId()
    {
        var configuration = CreateConfiguration("west");

        var result = MqServiceCollectionExtensions.ResolveConsumerGroupId(
            configuration, MqServiceCollectionExtensions.DefaultConsumerGroupId);

        Assert.Equal("featbit-control-plane-west", result);
    }

    [Fact]
    public void CustomGroupId_IsNeverModified_EvenWithDcIdConfigured()
    {
        var configuration = CreateConfiguration("west");

        var result = MqServiceCollectionExtensions.ResolveConsumerGroupId(
            configuration, "my-custom-group-id");

        Assert.Equal("my-custom-group-id", result);
    }

    [Fact]
    public void DefaultGroupId_WithoutDcId_IsUnchanged()
    {
        var configuration = CreateConfiguration(null);

        var result = MqServiceCollectionExtensions.ResolveConsumerGroupId(
            configuration, MqServiceCollectionExtensions.DefaultConsumerGroupId);

        Assert.Equal(MqServiceCollectionExtensions.DefaultConsumerGroupId, result);
    }

    [Fact]
    public void DefaultGroupId_WithEmptyDcId_IsUnchanged()
    {
        var configuration = CreateConfiguration("");

        var result = MqServiceCollectionExtensions.ResolveConsumerGroupId(
            configuration, MqServiceCollectionExtensions.DefaultConsumerGroupId);

        Assert.Equal(MqServiceCollectionExtensions.DefaultConsumerGroupId, result);
    }

    [Fact]
    public void CustomGroupId_WithoutDcId_IsUnchanged()
    {
        var configuration = CreateConfiguration(null);

        var result = MqServiceCollectionExtensions.ResolveConsumerGroupId(
            configuration, "featbit-control-plane-legacy");

        Assert.Equal("featbit-control-plane-legacy", result);
    }

    // ----- #105: real appsettings pinned to DefaultConsumerGroupId (drift breaks CI) -----

    private static IConfiguration LoadRealAppSettings(string fileName)
    {
        var path = Path.Combine(AppContext.BaseDirectory, "TestData", fileName);
        Assert.True(File.Exists(path), $"Expected the linked appsettings file at '{path}'.");

        return new ConfigurationBuilder()
            .AddJsonFile(path, optional: false)
            .Build();
    }

    [Fact]
    public void AppSettings_KafkaConsumerGroupId_MatchesDefaultConsumerGroupIdConstant()
    {
        var configuration = LoadRealAppSettings("appsettings.json");

        var groupId = configuration["Kafka:Consumer:group.id"];

        Assert.Equal(MqServiceCollectionExtensions.DefaultConsumerGroupId, groupId);
    }

    [Fact]
    public void AppSettingsDevelopment_KafkaConsumerGroupId_MatchesDefaultConsumerGroupIdConstant()
    {
        var configuration = LoadRealAppSettings("appsettings.Development.json");

        var groupId = configuration["Kafka:Consumer:group.id"];

        Assert.Equal(MqServiceCollectionExtensions.DefaultConsumerGroupId, groupId);
    }

    // ----- #105: multi-instance + empty-local-DcId + still-default-group.id collision-risk shape -----

    [Fact]
    public void CollisionRisk_MultiInstance_EmptyLocalDcId_StillDefaultGroupId_IsTrue()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Redis:Instances:0:DcId"] = "",
                ["Redis:Instances:0:ConnectionString"] = "redis-west:6379",
                ["Redis:Instances:1:DcId"] = "east",
                ["Redis:Instances:1:ConnectionString"] = "redis-east:6379"
            })
            .Build();

        var risk = MqServiceCollectionExtensions.IsMultiInstanceDefaultGroupIdCollisionRisk(
            configuration, MqServiceCollectionExtensions.DefaultConsumerGroupId);

        Assert.True(risk);
    }

    [Fact]
    public void CollisionRisk_SingleInstance_EmptyDcId_IsFalse()
    {
        // Single-DC/legacy deployments are today's preserved behavior — not a collision risk (there
        // is no peer to collide with).
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Redis:Instances:0:DcId"] = "",
                ["Redis:Instances:0:ConnectionString"] = "redis:6379"
            })
            .Build();

        var risk = MqServiceCollectionExtensions.IsMultiInstanceDefaultGroupIdCollisionRisk(
            configuration, MqServiceCollectionExtensions.DefaultConsumerGroupId);

        Assert.False(risk);
    }

    [Fact]
    public void CollisionRisk_MultiInstance_WithLocalDcId_IsFalse()
    {
        // A non-empty local DcId lets ResolveConsumerGroupId self-differentiate; not a risk.
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Redis:Instances:0:DcId"] = "west",
                ["Redis:Instances:0:ConnectionString"] = "redis-west:6379",
                ["Redis:Instances:1:DcId"] = "east",
                ["Redis:Instances:1:ConnectionString"] = "redis-east:6379"
            })
            .Build();

        var risk = MqServiceCollectionExtensions.IsMultiInstanceDefaultGroupIdCollisionRisk(
            configuration, MqServiceCollectionExtensions.DefaultConsumerGroupId);

        Assert.False(risk);
    }

    [Fact]
    public void CollisionRisk_MultiInstance_EmptyLocalDcId_ButCustomGroupId_IsFalse()
    {
        // An operator-set custom group.id already self-differentiates; not a risk regardless of DcId.
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Redis:Instances:0:DcId"] = "",
                ["Redis:Instances:0:ConnectionString"] = "redis-west:6379",
                ["Redis:Instances:1:DcId"] = "east",
                ["Redis:Instances:1:ConnectionString"] = "redis-east:6379"
            })
            .Build();

        var risk = MqServiceCollectionExtensions.IsMultiInstanceDefaultGroupIdCollisionRisk(
            configuration, "my-custom-group-id");

        Assert.False(risk);
    }
}
