using System.Net.WebSockets;
using Domain.EndUsers;
using Domain.Shared;
using Moq;
using Streaming.Connections;

namespace Streaming.UnitTests.Connections;

public class ConnectionToStringTests
{
    private readonly WebSocket _websocket = Mock.Of<WebSocket>(x => x.State == WebSocketState.Open);

    [Fact]
    public void ClientSideConnection()
    {
        var connection = new Connection(_websocket, TestData.ClientSecret);
        connection.AttachUser(new EndUser
        {
            KeyId = "tester",
            Name = "Test User",
            CustomizedProperties =
            [
                new CustomizedProperty { Name = "department", Value = "QA" }
            ]
        });

        var log = $"The connection is: {connection}";

        var expectedLog =
            $"The connection is: id={connection.Id},type=client,projectEnv=webapp:dev,user=tester,status=Open";

        Assert.Equal(log, expectedLog);
    }

    [Fact]
    public void ServerSideConnection()
    {
        var connection = new Connection(_websocket, TestData.ServerSecret);

        var log = $"The connection is: {connection}";

        var expectedLog =
            $"The connection is: id={connection.Id},type=server,projectEnv=webapp:prod,user=,status=Open";

        Assert.Equal(log, expectedLog);
    }
}