using System.Text.Json;
using Domain.EndUsers;
using Domain.Shared;
using Streaming.Connections;
using Streaming.Protocol;
using Streaming.Services;

namespace Streaming.Messages;

public class DataSyncMessageHandler(IReportEndUserService reportEndUserService, IDataSyncService service) : IMessageHandler
{
    public string Type => MessageTypes.DataSync;

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

            await reportEndUserService.ReportEndUserAndMauAsync(connection.EnvId, user);
        }

        var payload = await service.GetPayloadAsync(connectionContext, ctx.Data);
        var serverMessage = new ServerMessage(MessageTypes.DataSync, payload);
        await connectionContext.SendAsync(serverMessage, ctx.CancellationToken);
    }
}
