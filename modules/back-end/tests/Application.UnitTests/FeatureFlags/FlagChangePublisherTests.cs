using System.Text.Json;
using Application.FeatureFlags;
using Domain.Messages;
using Microsoft.Extensions.Configuration;

namespace Application.UnitTests.FeatureFlags;

public class DirectFeatureFlagChangePublisherTests
{
    [Fact]
    public async Task PublishDeletedAsync_Always_PublishesNothing()
    {
        var producer = new Mock<IMessageProducer>();
        var sut = new DirectFeatureFlagChangePublisher(producer.Object);

        await sut.PublishDeletedAsync(Guid.NewGuid(), Guid.NewGuid());

        Assert.Empty(producer.Invocations);
    }
}

public class ControlPlaneFeatureFlagChangePublisherTests
{
    [Fact]
    public async Task PublishDeletedAsync_Always_PublishesTheDeletedPayloadOnTheChangeTopic()
    {
        var envId = Guid.NewGuid();
        var flagId = Guid.NewGuid();
        var producer = new Mock<IMessageProducer>();
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Region"] = "us-east-1" })
            .Build();
        var sut = new ControlPlaneFeatureFlagChangePublisher(producer.Object, configuration);

        await sut.PublishDeletedAsync(envId, flagId);

        var invocation = Assert.Single(producer.Invocations);
        Assert.Equal(ControlPlaneTopics.ControlPlaneFeatureFlagChange, invocation.Arguments[0]);

        using var message = JsonDocument.Parse(JsonSerializer.Serialize(invocation.Arguments[1]));
        var root = message.RootElement;
        var deleted = root.GetProperty("deleted");
        Assert.Equal(envId, deleted.GetProperty("envId").GetGuid());
        Assert.Equal(flagId, deleted.GetProperty("id").GetGuid());
        Assert.Equal("us-east-1", root.GetProperty("region").GetString());
        Assert.False(root.TryGetProperty("notification", out _));
    }
}
