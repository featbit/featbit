using Microsoft.Extensions.Diagnostics.HealthChecks;
using Infrastructure.MongoDb;
using Domain.FeatureFlags;
using MongoDB.Driver;
using MongoDB.Bson;

namespace Api.Health
{
    public class MongoDbHealthCheck : IHealthCheck
    {
        private readonly MongoDbClient _mongoClient;
        
        public MongoDbHealthCheck(MongoDbClient mongoClient, ILogger<MongoDbHealthCheck> logger) 
        {
            _mongoClient = mongoClient;
        }

        public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
        {
            try
            {
                var featureFlagCollection = _mongoClient.CollectionOf<FeatureFlag>();
                var result = (await featureFlagCollection.Database.RunCommandAsync((Command<RawBsonDocument>)"{ping:1}"));
            }
            catch (Exception error)
            {
                return HealthCheckResult.Unhealthy("The MongoDB database is currently unavailable.", error);
            }

            return HealthCheckResult.Healthy("The MongoDB database is currently available.");
        }
    }
}
