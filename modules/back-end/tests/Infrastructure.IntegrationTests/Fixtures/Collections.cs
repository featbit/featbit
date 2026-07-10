using Infrastructure.IntegrationTests.Fixtures;

namespace Infrastructure.IntegrationTests.Fixtures;

[CollectionDefinition(MongoCollection.Name)]
public sealed class MongoCollection : ICollectionFixture<MongoDbFixture>
{
    public const string Name = "Mongo";
}

[CollectionDefinition(PostgresCollection.Name)]
public sealed class PostgresCollection : ICollectionFixture<PostgresFixture>
{
    public const string Name = "Postgres";
}

[CollectionDefinition(FeatBitPostgresCollection.Name)]
public sealed class FeatBitPostgresCollection : ICollectionFixture<FeatBitPostgresFixture>
{
    public const string Name = "FeatBitPostgres";
}

[CollectionDefinition(RedisCollection.Name)]
public sealed class RedisCollection : ICollectionFixture<RedisFixture>
{
    public const string Name = "Redis";
}

[CollectionDefinition(KafkaCollection.Name)]
public sealed class KafkaCollection : ICollectionFixture<KafkaFixture>
{
    public const string Name = "Kafka";
}
