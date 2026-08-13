namespace Api.IntegrationTests.Fixtures;

[CollectionDefinition(RedisCollection.Name)]
public sealed class RedisCollection : ICollectionFixture<RedisFixture>
{
    public const string Name = "Redis";
}

[CollectionDefinition(MongoRedisCollection.Name)]
public sealed class MongoRedisCollection : ICollectionFixture<MongoDbFixture>, ICollectionFixture<RedisFixture>
{
    public const string Name = "MongoRedis";
}
