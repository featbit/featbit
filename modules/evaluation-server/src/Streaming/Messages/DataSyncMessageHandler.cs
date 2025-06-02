using System.Text.Json;
using Domain.EndUsers;
using Domain.Messages;
using Domain.Shared;
using Streaming.Connections;
using Streaming.Protocol;
using Streaming.Services;

namespace Streaming.Messages;

public class DataSyncMessageHandler : IMessageHandler
{
    public string Type => MessageTypes.DataSync;

    private readonly IMessageProducer _producer;
    private readonly IDataSyncService _service;

    public DataSyncMessageHandler(IMessageProducer producer, IDataSyncService service)
    {
        _producer = producer;
        _service = service;
    }

    public async Task HandleAsync(MessageContext ctx)
    {
        var connectionContext = ctx.Connection;

        // handle client sdk prerequisites
        if (connectionContext.Type == ConnectionType.Client)
        {
            if (!ctx.Data.TryGetProperty("user", out var userProp))
            {
                throw new ArgumentException("client data sync message must attach user info.");
            }

            var user = userProp.Deserialize<EndUser?>(ReusableJsonSerializerOptions.Web);
            if (user == null || !user.IsValid())
            {
                throw new ArgumentException("client data sync message must attach valid user info.");
            }

            var connection = connectionContext.Connection;

            // attach client-side sdk EndUser
            connection.AttachUser(user);

            // publish end-user message
            var endUserMessage = new EndUserMessage(connection.EnvId, user);
            await _producer.PublishAsync(Topics.EndUser, endUserMessage);
        }

        var payload = await _service.GetPayloadAsync(connectionContext, ctx.Data);
        var serverMessage = new ServerMessage(MessageTypes.DataSync, payload);
        await connectionContext.SendAsync(serverMessage, ctx.CancellationToken);
    }
}