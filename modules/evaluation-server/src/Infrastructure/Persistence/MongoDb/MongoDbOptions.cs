using System.ComponentModel.DataAnnotations;

namespace Infrastructure.Persistence.MongoDb;

public class MongoDbOptions
{
    public const string MongoDb = nameof(MongoDb);

    [Required(ErrorMessage = "MongoDb connection string must be set.")]
    public string ConnectionString { get; set; } = string.Empty;

    [Required(ErrorMessage = "MongoDb database name must be set.")]
    public string Database { get; set; } = string.Empty;
}