namespace Infrastructure.Persistence;

public class DbProvider
{
    public const string SectionName = nameof(DbProvider);

    // only for integration tests (in-memory fake db)
    public const string Fake = nameof(Fake);

    public const string MongoDb = nameof(MongoDb);

    public const string Postgres = nameof(Postgres);

    public string Name { get; set; } = string.Empty;

    public string ConnectionString { get; set; } = string.Empty;
}