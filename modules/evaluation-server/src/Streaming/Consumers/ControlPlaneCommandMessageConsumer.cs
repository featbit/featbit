using System.Text.Json;
using Domain.ControlPlane;
using Domain.Messages;
using Domain.Shared;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Streaming.Services;
using Action = Domain.ControlPlane.Action;

namespace Streaming.Consumers;

public partial class ControlPlaneCommandMessageConsumer(
    IAdminService adminService,
    IConfiguration configuration,
    ILogger<ControlPlaneCommandMessageConsumer> logger) : IMessageConsumer
{
    public string Topic => Topics.ControlPlaneCommand;

    public async Task HandleAsync(string message, CancellationToken cancellationToken)
    {
        try
        {
            var command = JsonSerializer.Deserialize<ControlPlaneCommand>(message, ReusableJsonSerializerOptions.Web);
            if (command == null)
            {
                Log.InvalidMessageFormat(logger, message);
                return;
            }

            // Per-DC targeting: when the command names a TargetDcId, only the matching DC's eval
            // servers act on it; everyone else ignores it. A null TargetDcId keeps the original
            // broadcast behavior (every DC acts). Read the local DcId the same way GetDcId() does
            // (config key "ControlPlane:DcId"); Streaming does not reference the Api project where
            // that extension lives, so the key is read directly here.
            if (!string.IsNullOrEmpty(command.TargetDcId))
            {
                var localDcId = configuration.GetValue<string>("ControlPlane:DcId");
                if (!string.Equals(command.TargetDcId, localDcId, StringComparison.Ordinal))
                {
                    Log.IgnoringTargetedCommand(logger, command.TargetDcId, localDcId);
                    return;
                }
            }

            switch (command.Action)
            {
                case Action.PushFullSync:
                    await adminService.PushFullSyncToAllActiveSdks();
                    break;
                default:
                    throw new InvalidOperationException($"Invalid action: {command.Action}");
            }
        }
        catch (Exception ex)
        {
            Log.ProcessingFailed(logger, message, ex);
        }
    }
}