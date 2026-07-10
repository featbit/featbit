using Application.Services;
using Application.Webhooks;
using Domain.Webhooks;

namespace Application.UnitTests.Handlers;

public class SendWebhookHandlerTests
{
    [Fact]
    public async Task Handle_EmptyPayloadObjectAndPreventEmpty_ReturnsIgnoredAndDoesNotSend()
    {
        var sender = new Mock<IWebhookSender>();
        var sut = new SendWebhookHandler(sender.Object);
        var request = new SendWebhook
        {
            DeliveryId = "d",
            Url = "https://x",
            Events = "feature_flag.created",
            Payload = "{}",
            PreventEmptyPayloads = true
        };

        var result = await sut.Handle(request, CancellationToken.None);

        Assert.False(result.Success);
        Assert.True(result.IsIgnored());
        sender.Verify(x => x.SendAsync(It.IsAny<WebhookRequest>()), Times.Never);
    }

    [Fact]
    public async Task Handle_NonEmptyPayload_DelegatesToSender()
    {
        var sender = new Mock<IWebhookSender>();
        var expected = new WebhookDelivery(Guid.NewGuid(), "feature_flag.created") { Success = true };
        sender.Setup(x => x.SendAsync(It.IsAny<WebhookRequest>())).ReturnsAsync(expected);
        var sut = new SendWebhookHandler(sender.Object);
        var request = new SendWebhook
        {
            DeliveryId = "d",
            Url = "https://x",
            Events = "feature_flag.created",
            Payload = "{\"a\":1}",
            PreventEmptyPayloads = true
        };

        var result = await sut.Handle(request, CancellationToken.None);

        Assert.Same(expected, result);
        sender.Verify(x => x.SendAsync(It.IsAny<WebhookRequest>()), Times.Once);
    }

    [Fact]
    public async Task Handle_EmptyPayloadButPreventEmptyDisabled_DelegatesToSender()
    {
        var sender = new Mock<IWebhookSender>();
        var delivery = new WebhookDelivery(Guid.NewGuid(), "feature_flag.created");
        sender.Setup(x => x.SendAsync(It.IsAny<WebhookRequest>())).ReturnsAsync(delivery);
        var sut = new SendWebhookHandler(sender.Object);
        var request = new SendWebhook
        {
            DeliveryId = "d",
            Url = "https://x",
            Events = "feature_flag.created",
            Payload = "{}",
            PreventEmptyPayloads = false
        };

        var result = await sut.Handle(request, CancellationToken.None);

        Assert.Same(delivery, result);
        sender.Verify(x => x.SendAsync(It.IsAny<WebhookRequest>()), Times.Once);
    }
}
