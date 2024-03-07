using System.Net.WebSockets;
using System.Text;
using Moq;
using Streaming.Connections;
using Streaming.Messages;
using TestBase;

namespace Streaming.UnitTests.Connections;

public class ConnectionHandlerTests
{
    [Fact]
    public void OnMessageErrorLogTests()
    {
        var (handler, logger) = Arrange();
        var connection = new ConnectionBuilder()
            .WithClientIp("10.0.0.7")
            .WithClientHost("my.client.host")
            .WithEnvId(TestData.DevEnvId)
            .Build();
        
        handler.OnMessageError(connection, "error");
            
        Assert.NotNull(logger.Message);
        Assert.Contains("10.0.0.7", logger.Message);
        Assert.Contains("my.client.host", logger.Message);
        Assert.Contains(TestData.DevEnvId.ToString(), logger.Message);
    }

    [Theory]
    [ClassData(typeof(Messages))]
    public async Task OnMessageAsyncLogTests(Message message, bool threwException)
    {
        var (handler, logger) = Arrange(new ErrorThrowingMessageHandler());
        var connection = new ConnectionBuilder()
            .WithClientIp("10.0.0.7")
            .WithClientHost("my.client.host")
            .WithEnvId(TestData.DevEnvId)
            .Build();
        
        await handler.OnMessageAsync(connection, message,default);

        Assert.NotNull(logger.Message);
        if (threwException)
        {
            Assert.NotNull(logger.Ex);
        }
        else
        {
            Assert.Null(logger.Ex);
        }
        Assert.Contains("10.0.0.7", logger.Message);
        Assert.Contains("my.client.host", logger.Message);
        Assert.Contains(TestData.DevEnvId.ToString(), logger.Message);
    }

    private (ConnectionHandler handler, InMemoryFakeLogger<ConnectionHandler> logger) Arrange(params IMessageHandler[] handlers)
    {
        var logger = new InMemoryFakeLogger<ConnectionHandler>();
        var mockManager = new Mock<IConnectionManager>();
        var handler = new ConnectionHandler(mockManager.Object, handlers, logger);
        return (handler, logger);
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