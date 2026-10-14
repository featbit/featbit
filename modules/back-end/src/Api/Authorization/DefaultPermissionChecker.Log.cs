using Microsoft.Extensions.Logging;

namespace Api.Authorization;

public partial class DefaultPermissionChecker
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Warning, "The permission '{Permission}' has no corresponding resourceType.",
            EventName = "UnmappedPermission")]
        public static partial void UnmappedPermission(ILogger logger, string permission);

        [LoggerMessage(2, LogLevel.Warning, "Invalid projectId '{ProjectId}' in route values.",
            EventName = "InvalidProjectId")]
        public static partial void InvalidProjectId(ILogger logger, string projectId);

        [LoggerMessage(3, LogLevel.Warning, "Invalid envId '{EnvId}' in route values.",
            EventName = "InvalidEnvId")]
        public static partial void InvalidEnvId(ILogger logger, string? envId);

        // segmentId comes straight out of RouteValueDictionary, whose values are object?.
        [LoggerMessage(4, LogLevel.Warning, "Invalid segmentId '{SegmentId}' in route values.",
            EventName = "InvalidSegmentId")]
        public static partial void InvalidSegmentId(ILogger logger, object? segmentId);
    }
}
