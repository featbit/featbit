using System.Text.Json;
using Domain.EndUsers;
using Domain.Messages;
using Domain.Usages;
using Moq;
using Streaming.Connections;
using Streaming.Messages;
using Streaming.Services;
using Streaming.UnitTests.Builders;

namespace Streaming.UnitTests.Messages;

public class DataSyncMessageHandlerTests
{
    [Theory]
    [InlineData(ConnectionType.Client)]
    [InlineData(ConnectionType.Server)]
    [InlineData(ConnectionType.RelayProxy)]
    public async Task Sync_OnlyClientRecordsMauAndPreservesEndUser(string type)
    {
        var connection = new ConnectionContextBuilder().WithType(type).Build();
        var producer = new Mock<IMessageProducer>();
        var service = new Mock<IDataSyncService>();
        service.Setup(s => s.GetPayloadAsync(connection, It.IsAny<JsonElement>())).ReturnsAsync(new { });
        var handler = new DataSyncMessageHandler(producer.Object, service.Object);

        foreach (var key in new[] { "user-a", "user-b" })
        {
            var data = JsonSerializer.SerializeToElement(new { user = new { keyId = key }, timestamp = 0 });
            await handler.HandleAsync(new MessageContext(connection, data, CancellationToken.None));
            if (type == ConnectionType.Client)
            {
                Assert.Equal(key, connection.Connection.User!.KeyId);
                producer.Verify(p => p.PublishAsync(Topics.EndUser, It.Is<EndUserMessage>(u =>
                    u.EnvId == connection.Connection.EnvId && u.KeyId == key)), Times.Once);
                producer.Verify(p => p.PublishAsync(Topics.Usage, It.Is<InsightUsage>(u =>
                    u.EnvId == connection.Connection.EnvId && u.EndUsers.Count == 1 && u.EndUsers.Contains(key) &&
                    u.FlagEvaluations == 0 && u.CustomMetrics == 0)), Times.Once);
            }
        }
        producer.VerifyNoOtherCalls();
    }

}
