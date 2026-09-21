using System.Collections.Concurrent;
using Domain.Utils;
using Infrastructure.Persistence.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Infrastructure.IntegrationTests.Support;

/// <summary>
/// Builds an <see cref="AppDbContext"/> wired to a Testcontainers Postgres,
/// configured to match production: dynamic JSON with the web (camelCase)
/// serializer options, snake_case naming, no tracking. The underlying
/// NpgsqlDataSource (and its connection pool) is cached per connection
/// string so repeated calls share one pool instead of exhausting Postgres'
/// max_connections with a fresh pool each time.
/// </summary>
internal static class AppDbContextFactory
{
    private static readonly ConcurrentDictionary<string, NpgsqlDataSource> DataSources = new();

    public static AppDbContext Create(string connectionString)
    {
        var dataSource = DataSources.GetOrAdd(connectionString, static cs => new NpgsqlDataSourceBuilder(cs)
            .EnableDynamicJson()
            .ConfigureJsonOptions(ReusableJsonSerializerOptions.Web)
            .Build()
        );

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(dataSource, op => op.EnableRetryOnFailure())
            .UseSnakeCaseNamingConvention()
            .UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking)
            .Options;

        return new AppDbContext(options);
    }
}
