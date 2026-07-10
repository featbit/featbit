using Domain.Utils;
using Infrastructure.Persistence.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Infrastructure.IntegrationTests.Support;

/// <summary>
/// Builds an <see cref="AppDbContext"/> wired to a Testcontainers Postgres,
/// configured to match production: dynamic JSON with the web (camelCase)
/// serializer options, snake_case naming, no tracking. Each call returns a
/// fresh context backed by its own NpgsqlDataSource so tests can dispose
/// freely without leaking connections.
/// </summary>
internal static class AppDbContextFactory
{
    public static AppDbContext Create(string connectionString)
    {
        var dataSource = new NpgsqlDataSourceBuilder(connectionString)
            .EnableDynamicJson()
            .ConfigureJsonOptions(ReusableJsonSerializerOptions.Web)
            .Build();

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(dataSource)
            .UseSnakeCaseNamingConvention()
            .UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking)
            .Options;

        return new AppDbContext(options);
    }
}
