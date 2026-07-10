using System.ComponentModel.DataAnnotations;
using Infrastructure.Caches.Redis;
using Infrastructure.Persistence;
using Infrastructure.Persistence.MongoDb;

namespace Infrastructure.UnitTests.Persistence;

public class OptionsValidationTests
{
    [Fact]
    public void MongoDbOptions_MissingConnectionStringAndDatabase_FailsValidation()
    {
        var options = new MongoDbOptions();

        var results = Validate(options);

        Assert.Contains(results, r => r.ErrorMessage == "MongoDb connection string must be set.");
        Assert.Contains(results, r => r.ErrorMessage == "MongoDb database name must be set.");
    }

    [Fact]
    public void MongoDbOptions_AllRequiredSet_PassesValidation()
    {
        var options = new MongoDbOptions { ConnectionString = "mongodb://localhost", Database = "featbit" };

        Assert.Empty(Validate(options));
    }

    [Fact]
    public void PostgresOptions_MissingConnectionString_FailsValidation()
    {
        var options = new PostgresOptions();

        var results = Validate(options);

        Assert.Contains(results, r => r.ErrorMessage == "Postgres connection string must be set.");
    }

    [Fact]
    public void PostgresOptions_ConnectionStringSet_PassesValidation()
    {
        var options = new PostgresOptions { ConnectionString = "Host=localhost", Password = "" };

        Assert.Empty(Validate(options));
    }

    [Fact]
    public void RedisOptions_MissingConnectionString_FailsValidation()
    {
        var options = new RedisOptions();

        var results = Validate(options);

        Assert.Contains(results, r => r.ErrorMessage == "Redis connection string must be set.");
    }

    [Fact]
    public void RedisOptions_ConnectionStringSet_PassesValidation()
    {
        var options = new RedisOptions { ConnectionString = "localhost:6379", Password = "" };

        Assert.Empty(Validate(options));
    }

    private static List<ValidationResult> Validate(object instance)
    {
        var results = new List<ValidationResult>();
        Validator.TryValidateObject(instance, new ValidationContext(instance), results, validateAllProperties: true);
        return results;
    }
}
