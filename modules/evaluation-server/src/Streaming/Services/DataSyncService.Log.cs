using Microsoft.Extensions.Logging;

namespace Streaming.Services;

public partial class DataSyncService
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Error,
            "Failed to evaluate feature flag {FlagKey} ({FlagId}) in environment {EnvId}. " +
            "Malformed entity: {EntityType} ({EntityId}), property: {PropertyPath}. " +
            "The malformed entity was skipped without failing the client data-sync.",
            EventName = "EvaluationFailed")]
        public static partial void EvaluationFailed(ILogger logger, string? flagKey, string? flagId, Guid envId, string entityType, string? entityId, string? propertyPath, Exception exception);
    }
}
