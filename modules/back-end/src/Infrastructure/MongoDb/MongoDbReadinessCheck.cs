using Microsoft.Extensions.Diagnostics.HealthChecks;
using Domain.FeatureFlags;
using MongoDB.Driver;
using MongoDB.Bson;

namespace Infrastructure.MongoDb;

public class MongoDbReadinessCheck : IHealthCheck
{
    private readonly MongoDbClient _mongoClient;
    
    public MongoDbReadinessCheck(MongoDbClient mongoClient)
    {
        _mongoClient = mongoClient;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            var featureFlagCollection = _mongoClient.CollectionOf<FeatureFlag>();
            await featureFlagCollection.Database.RunCommandAsync((Command<RawBsonDocument>)"{ping:1}");
        }
        catch (Exception exception)
        {
            return HealthCheckResult.Unhealthy("The MongoDB database is currently unavailable.", exception);
        }

        return HealthCheckResult.Healthy("The MongoDB database is currently available.");
    }
}
