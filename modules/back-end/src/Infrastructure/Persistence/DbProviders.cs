namespace Infrastructure.Persistence;

public abstract class DbProviders
{
    public const string MongoDb = nameof(MongoDb);

    public const string Postgres = nameof(Postgres);
}