using System.Net.WebSockets;
using System.Text;
using Domain.Shared;
using Moq;
using Streaming.Connections;
using Streaming.Messages;
using TestBase;

namespace Streaming.UnitTests.Connections;

public class ConnectionHandlerTests
{
    private readonly Connection _connection = new ConnectionBuilder()
        .WithId("this-connection-id")
        .WithSecret(new Secret("server", "webapp", Guid.NewGuid(), "dev"))
        .WithClient(new Client("10.0.0.7", "my.client.host"))
        .Build();

    // [{ProjectKey}:{EnvKey}:{ClientIpAddress}:{ClientHost}:{ConnectionId}]
    private const string LogPrefix = "[webapp:dev:10.0.0.7:my.client.host:this-connection-id]";

    [Fact]
    public void OnMessageErrorLogTests()
    {
        var logger = new InMemoryFakeLogger<ConnectionHandler>();
        var handler = new ConnectionHandler(null!, Array.Empty<IMessageHandler>(), logger);

        handler.OnMessageError(_connection, "ERROR!");

        Assert.StartsWith(LogPrefix, logger.Message);
    }

    [Theory]
    [ClassData(typeof(Messages))]
    public async Task OnMessageAsyncLogTests(Message message, bool threwException)
    {
        var logger = new InMemoryFakeLogger<ConnectionHandler>();
        var handler = new ConnectionHandler(null!, new[] { new ErrorThrowingMessageHandler() }, logger);

        await handler.OnMessageAsync(_connection, message, default);

        Assert.NotNull(logger.Message);
        if (threwException)
        {
            Assert.NotNull(logger.Ex);
        }
        else
        {
            Assert.Null(logger.Ex);
        }

        Assert.StartsWith(LogPrefix, logger.Message);
    }
}

public class Messages : TheoryData<Message, bool>
{
    public Messages()
    {
        // close message log scenario
        var closeMessage = new Message(new byte[16], WebSocketMessageType.Close);
        Add(closeMessage, false);

        // empty message log scenario
        Add(Message.EmptyText, false);

        // missing handler message log scenario
        var missingHandlerMessage = new Message(
            Encoding.UTF8.GetBytes("{\"messageType\":\"unregistered\",\"data\":{}}"),
            WebSocketMessageType.Text
        );
        Add(missingHandlerMessage, false);

        // invalid json message log scenario
        var invalidJsonMessage = new Message(
            Encoding.UTF8.GetBytes("{this is not ][valid json}"),
            WebSocketMessageType.Text
        );
        Add(invalidJsonMessage, true);

        // error-throwing message log scenario
        var errorThrowingMessage = new Message(
            Encoding.UTF8.GetBytes("{\"messageType\":\"error-throwing\",\"data\":{}}"),
            WebSocketMessageType.Text
        );
        Add(errorThrowingMessage, true);
    }
}

public class ErrorThrowingMessageHandler : IMessageHandler
{
    public string Type => "error-throwing";

    public Task HandleAsync(MessageContext ctx)
    {
        throw new Exception("Test Error!");
    }
}