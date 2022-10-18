using System.Text.Json;
using Domain.Protocol;
using Microsoft.Extensions.Logging;

namespace Domain.WebSockets;

public partial class MessageHandler : IMessageHandler
{
    // message json format
    // { messageType: "", data: { } }

    private const string MessageTypePropertyName = "messageType";
    private const string DataPropertyName = "data";

    private readonly ILogger<MessageHandler> _logger;

    public MessageHandler(ILogger<MessageHandler> logger)
    {
        _logger = logger;
    }

    public async Task HandleAsync(Connection connection, Message message, CancellationToken token)
    {
        var json = message.Bytes;

        try
        {
            using var document = JsonDocument.Parse(json);

            var root = document.RootElement;
            if (!root.TryGetProperty(MessageTypePropertyName, out var messageTypeElement) ||
                !root.TryGetProperty(DataPropertyName, out _))
            {
                return;
            }

            var messageType = messageTypeElement.GetString();
            switch (messageType)
            {
                case MessageTypes.Ping:
                    await connection.SendAsync(Message.Pong, token);
                    break;

                case MessageTypes.Echo:
                    await connection.SendAsync(message, token);
                    break;
            }
        }
        catch (JsonException ex)
        {
            // ignore invalid json
            Log.ReceiveInvalidMessage(_logger, connection.Id, ex);
        }
        catch (Exception ex)
        {
            // error when handle message
            Log.ErrorHandleMessage(_logger, connection.Id, ex);
        }
    }
}