using System;
using Microsoft.Extensions.Logging;

namespace Streaming.Services
{
    public partial class AdminService
    {
        public static partial class Log
        {
            [LoggerMessage(1, LogLevel.Error,
                "Push full sync failed for env {EnvId}; continuing with remaining envs",
                EventName = "PushFullSyncEnvFailed")]
            public static partial void PushFullSyncEnvFailed(ILogger logger, Guid envId, Exception ex);

            [LoggerMessage(2, LogLevel.Information,
                "Env {EnvId}: skipped {UnidentifiedClientCount} unidentified client connections; no eligible connections to push to",
                EventName = "NoEligibleConnections")]
            public static partial void NoEligibleConnections(ILogger logger, Guid envId, int unidentifiedClientCount);

            [LoggerMessage(3, LogLevel.Error,
                "Failed to build server SDK payload for env {EnvId}; skipping {ServerCount} server connections in this env",
                EventName = "ServerPayloadBuildFailed")]
            public static partial void ServerPayloadBuildFailed(ILogger logger, Guid envId, int serverCount, Exception ex);

            [LoggerMessage(4, LogLevel.Information,
                "Env {EnvId}: pushed full sync to {ServerCount} server and {ClientCount} client connections (skipped {UnidentifiedClientCount} unidentified client)",
                EventName = "PushedFullSync")]
            public static partial void PushedFullSync(ILogger logger, Guid envId, int serverCount, int clientCount, int unidentifiedClientCount);

            [LoggerMessage(5, LogLevel.Error,
                "Push full sync send failed for connection {ConnectionId} in env {EnvId}",
                EventName = "PushFullSyncSendFailed")]
            public static partial void PushFullSyncSendFailed(ILogger logger, string connectionId, Guid envId, Exception ex);
        }
    }
}
