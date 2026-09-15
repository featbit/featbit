using Microsoft.Extensions.Logging;

namespace Infrastructure.Services.EntityFrameworkCore;

public partial class FeatureFlagService
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Error,
            "SetPendingAsync exhausted {MaxRetries} retries for FeatureFlag {EnvId}/{Key} " +
            "at version {Version} (attempt {Attempt}); the Redis stage for this change may " +
            "now be orphaned until superseded by the next edit or reaped by StagedFlagGc.",
            EventName = "SetPendingRetriesExhausted")]
        public static partial void SetPendingRetriesExhausted(
            ILogger logger, int maxRetries, Guid envId, string key, long version, int attempt,
            Exception ex);

        [LoggerMessage(2, LogLevel.Error,
            "PromotePendingAsync exhausted {MaxRetries} retries for FeatureFlag {EnvId}/{Key} " +
            "at expected version {ExpectedVersion} (attempt {Attempt}).",
            EventName = "PromotePendingRetriesExhausted")]
        public static partial void PromotePendingRetriesExhausted(
            ILogger logger, int maxRetries, Guid envId, string key, long expectedVersion, int attempt,
            Exception ex);
    }
}
