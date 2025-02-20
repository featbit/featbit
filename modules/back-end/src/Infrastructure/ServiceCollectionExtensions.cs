using Confluent.Kafka;
using Dapper;
using Domain.EndUsers;
using Domain.Messages;
using Domain.Utils;
using Infrastructure.Kafka;
using Infrastructure.Messages;
using Infrastructure.Persistence.Dapper;
using Infrastructure.Redis;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace Infrastructure;

public static class ServiceCollectionExtensions
{
    public static void AddMongoDb(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<MongoDbOptions>(configuration.GetSection(MongoDbOptions.MongoDb));
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
                .UseNpgsql(dataSource)
                .UseSnakeCaseNamingConvention()
                .UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking)
        );
    }

    public static void AddMessagingServices(this IServiceCollection services,
        IConfiguration configuration)
    {
        if (configuration.IsProVersion())
        {
            var producerConfigDictionary = new Dictionary<string, string>();
            configuration.GetSection("Kafka:Producer").Bind(producerConfigDictionary);
            var producerConfig = new ProducerConfig(producerConfigDictionary);
            services.AddSingleton(producerConfig);

            var consumerConfigDictionary = new Dictionary<string, string>();
            configuration.GetSection("Kafka:Consumer").Bind(consumerConfigDictionary);
            var consumerConfig = new ConsumerConfig(consumerConfigDictionary);
            services.AddSingleton(consumerConfig);

            // use kafka as message queue in pro version
            services.AddSingleton<IMessageProducer, KafkaMessageProducer>();
            services.AddHostedService<KafkaMessageConsumer>();
        }
        else
        {
            // use redis as message queue
            services.AddSingleton<IMessageProducer, RedisMessageProducer>();

            services.AddTransient<IMessageHandler, EndUserMessageHandler>();
            services.AddTransient<IMessageHandler, InsightMessageHandler>();
            services.AddHostedService<RedisMessageConsumer>();
        }
    }
}