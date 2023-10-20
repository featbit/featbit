namespace Infrastructure.MongoDb;

public class MongoDbOptions
{
    public const string MongoDb = nameof(MongoDb);

    public string ConnectionString { get; set; } = string.Empty;

    public string Database { get; set; } = string.Empty;
}