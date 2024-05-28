using Infrastructure.Readiness;

namespace Infrastructure.MongoDb;

public class MongoDbReadinessCheck : ReadinessCheck
{
    public MongoDbReadinessCheck(IMongoDbClient mongoClient) 
        : base(healthyCheck: mongoClient.IsHealthyAsync, serviceName: "The MongoDB database")
    { }
}
