using Microsoft.Extensions.Logging;

namespace Infrastructure.Store;

public partial class RedisStore
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Warning,
            "Orphan {EntityName} index members in env {EnvId}: {OrphanCount} of {TotalCount}. Missing keys: {MissingKeys}",
            EventName = "OrphanIndexMembers")]
        public static partial void OrphanIndexMembers(ILogger logger, string entityName, Guid envId, int orphanCount, int totalCount, string missingKeys);

        [LoggerMessage(2, LogLevel.Warning,
            "Orphan {EntityName} ids requested: {OrphanCount} of {TotalCount}. Missing keys: {MissingKeys}",
            EventName = "OrphanIdsRequested")]
        public static partial void OrphanIdsRequested(ILogger logger, string entityName, int orphanCount, int totalCount, string missingKeys);
    }
}
