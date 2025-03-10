using Dapper;
using Domain.EndUsers;
using Domain.Utils;
using Infrastructure.Persistence.Dapper;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace Infrastructure;

public static class ServiceCollectionExtensions
{
    public static void AddMongoDb(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptionsWithValidateOnStart<MongoDbOptions>()
            .Bind(configuration.GetSection(MongoDbOptions.MongoDb))
            .ValidateDataAnnotations();

        services.AddSingleton<MongoDbClient>();
    }

    public static void ConfigureDapper(this IServiceCollection services)
    {
        // our database uses snake_case naming convention
        DefaultTypeMap.MatchNamesWithUnderscores = true;

        // jsonb column type mappings (add when needed)
        SqlMapper.AddTypeHandler(typeof(ICollection<EndUserCustomizedProperty>), new JsonObjectTypeHandler());
    }

    public static void AddPostgres(this IServiceCollection services, IConfiguration configuration)
    {
        // https://github.com/npgsql/efcore.pg/issues/1107
        // https://github.com/npgsql/efcore.pg/issues/3119

        var postgresProvider = configuration.GetDbProvider();

        var dataSourceBuilder = new NpgsqlDataSourceBuilder(postgresProvider.ConnectionString);
        dataSourceBuilder.EnableDynamicJson().ConfigureJsonOptions(ReusableJsonSerializerOptions.Web);
        var dataSource = dataSourceBuilder.Build();

        services.AddDbContext<AppDbContext>(
            op => op
                .UseNpgsql(dataSource, options => options.EnableRetryOnFailure())
                .UseSnakeCaseNamingConvention()
                .UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking)
        );
    }
}