using System.Text.Json;
using Application.Caches;
using Domain.Messages;
using Domain.Utils;
using Domain.Workspaces;

namespace Api.Application.ControlPlane;

public class LicenseChangeMessageHandler([FromKeyedServices("compositeCache")] ICacheService cacheService, ILogger<LicenseChangeMessageHandler> logger) : IMessageHandler
{
    public string Topic => ControlPlaneTopics.ControlPlaneLicenseChange;

    public async Task HandleAsync(string message)
    {
        try
        {
            var workspace = JsonSerializer.Deserialize<Workspace>(message, ReusableJsonSerializerOptions.Web);
            if (workspace != null)
            {
                await cacheService.UpsertLicenseAsync(workspace);
            }
        }
        catch (Exception e)
        {
            logger.LogError(e, "Error handling license change message");
            throw;
        }

    }
}