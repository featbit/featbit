using Microsoft.Extensions.Logging;

namespace Infrastructure.Services.MongoDb;

public partial class EnvironmentService
{
    public static partial class Log
    {
        [LoggerMessage(1, LogLevel.Warning,
            "Data inconsistency detected: Resource descriptor not found for environment with ID {EnvId}. Please verify the integrity of the environment data in the database.",
            EventName = "ResourceDescriptorNotFound")]
        public static partial void ResourceDescriptorNotFound(ILogger logger, Guid envId);
    }
}