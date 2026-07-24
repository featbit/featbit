using System.Text.Json;
using Application.Caches;
using Domain.Messages;

namespace Api.Application.ControlPlane;

public class ClientConnectionMadeHandler(ICacheService cacheService, ILogger<ClientConnectionMadeHandler> logger) : IMessageHandler
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public string Topic => ControlPlaneTopics.ConnectionMade;

    public async Task HandleAsync(string message)
    {
        logger.LogInformation("Handling connection made message: {Message}", message);

        ConnectionMessage? connectionInfo;
        try
        {
            connectionInfo = JsonSerializer.Deserialize<ConnectionMessage>(message, JsonOptions);
        }
        catch (JsonException ex)
        {
            logger.LogError(ex, "Failed to deserialize connection message: {Message}", message);
            return;
        }

        if (!TryValidate(connectionInfo, message))
        {
            return;
        }

        await cacheService.UpsertConnectionMadeAsync(connectionInfo);
    }

    private bool TryValidate(ConnectionMessage? connectionInfo, string rawMessage)
    {
        if (connectionInfo is null)
        {
            logger.LogError("Connection message is null after deserialization: {Message}", rawMessage);
            return false;
        }
        
        if (string.IsNullOrWhiteSpace(connectionInfo.Id))
        {
            logger.LogError("Connection id is null or empty: {Message}", rawMessage);
            return false;
        }

        if (string.IsNullOrWhiteSpace(connectionInfo.Secret))
        {
            logger.LogError("Connection secret is null or empty: {Message}", rawMessage);
            return false;
        }

        if (connectionInfo.EnvId == Guid.Empty)
        {
            logger.LogError("Connection env id is empty: {Message}", rawMessage);
            return false;
        }
        
        return true;
    }
}
