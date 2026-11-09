using System.Text.Json;
using Application.Segments;
using Application.Services;
using Domain.Messages;
using Microsoft.Extensions.Configuration;

namespace Application.UnitTests.Segments;

public class DirectSegmentChangePublisherTests
{
    [Fact]
    public async Task PublishDeletedAsync_Always_DoesNothing()
    {
        var messageService = new Mock<ISegmentMessageService>();
        var flagAppService = new Mock<IFeatureFlagAppService>();
        var segmentService = new Mock<ISegmentService>();
        var sut = new DirectSegmentChangePublisher(messageService.Object, flagAppService.Object, segmentService.Object);

        await sut.PublishDeletedAsync([Guid.NewGuid()], Guid.NewGuid());

        Assert.Empty(messageService.Invocations);
        Assert.Empty(flagAppService.Invocations);
        Assert.Empty(segmentService.Invocations);
    }
}

public class ControlPlaneSegmentChangePublisherTests
{
    [Fact]
    public async Task PublishDeletedAsync_Always_PublishesTheDeletedPayloadOnTheChangeTopic()
    {
        Guid[] envIds = [Guid.NewGuid(), Guid.NewGuid()];
        var segmentId = Guid.NewGuid();
        var producer = new Mock<IMessageProducer>();
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Region"] = "us-east-1" })
            .Build();
        var sut = new ControlPlaneSegmentChangePublisher(producer.Object, new Mock<ISegmentService>().Object, configuration);

        await sut.PublishDeletedAsync(envIds, segmentId);

        var invocation = Assert.Single(producer.Invocations);
        Assert.Equal(ControlPlaneTopics.ControlPlaneSegmentChange, invocation.Arguments[0]);

        using var message = JsonDocument.Parse(JsonSerializer.Serialize(invocation.Arguments[1]));
        var root = message.RootElement;
        var deleted = root.GetProperty("deleted");
        Assert.Equal(envIds, deleted.GetProperty("envIds").EnumerateArray().Select(x => x.GetGuid()).ToArray());
        Assert.Equal(segmentId, deleted.GetProperty("id").GetGuid());
        Assert.Equal("us-east-1", root.GetProperty("region").GetString());
        Assert.False(root.TryGetProperty("notification", out _));
    }
}
