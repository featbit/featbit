using Dapper;
using Domain.EndUsers;
using Domain.Utils;
using Infrastructure.Caches.Redis;
using Infrastructure.Persistence.Dapper;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using StackExchange.Redis;

namespace Infrastructure;

public static class ServiceCollectionExtensions
{
    public static void ConfigureDapper(this IServiceCollection services)
    {
        // our database uses snake_case naming convention
        DefaultTypeMap.MatchNamesWithUnderscores = true;

        // jsonb column type mappings (add when needed)
        SqlMapper.AddTypeHandler(typeof(ICollection<EndUserCustomizedProperty>), new JsonObjectTypeHandler());
    }

    public static void TryAddRedis(this IServiceCollection services, IConfiguration configuration)
    {
        if (services.Any(service => service.ServiceType == typeof(IRedisClient)))
        {
            return;
        }

        services.AddOptionsWithValidateOnStart<RedisOptions>()
            .Bind(configuration.GetSection(RedisOptions.Redis))
            .ValidateDataAnnotations();

        services.AddSingleton<IRedisClient, RedisClient>();
    }

    public static void TryAddMongoDb(this IServiceCollection services, IConfiguration configuration)
    {
        if (services.Any(service => service.ServiceType == typeof(MongoDbClient)))
        {
            return;
        }

        services.AddOptionsWithValidateOnStart<MongoDbOptions>()
            .Bind(configuration.GetSection(MongoDbOptions.MongoDb))
            .ValidateDataAnnotations();

        services.AddSingleton<MongoDbClient>();
    }

    public static void TryAddPostgres(this IServiceCollection services, IConfiguration configuration)
    {
        if (services.Any(service => service.ServiceType == typeof(NpgsqlDataSource)))
        {
            return;
        }

        services.AddOptionsWithValidateOnStart<PostgresOptions>()
            .Bind(configuration.GetSection(PostgresOptions.Postgres))
            .ValidateDataAnnotations();

        // https://github.com/npgsql/efcore.pg/issues/1107
        // https://github.com/npgsql/efcore.pg/issues/3119

        services.AddNpgsqlDataSource(configuration.GetPostgresConnectionString(), builder =>
        {
            builder
                .EnableDynamicJson()
                .ConfigureJsonOptions(ReusableJsonSerializerOptions.Web);
        });

        services.AddDbContext<AppDbContext>((serviceProvider, options) =>
        {
            options
                .UseNpgsql(serviceProvider.GetRequiredService<NpgsqlDataSource>(), op => op.EnableRetryOnFailure())
                .UseSnakeCaseNamingConvention()
                .UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking);
        });
    }
}