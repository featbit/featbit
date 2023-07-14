using Application.Caches;
using Domain.Messages;
using Domain.Users;
using Infrastructure.AccessTokens;
using Infrastructure.AuditLogs;
using Infrastructure.DataSync;
using Infrastructure.EndUsers;
using Infrastructure.Environments;
using Infrastructure.ExperimentMetrics;
using Infrastructure.Experiments;
using Infrastructure.FeatureFlags;
using Infrastructure.Groups;
using Infrastructure.Identity;
using Infrastructure.Members;
using Infrastructure.Kafka;
using Infrastructure.Messages;
using Infrastructure.Organizations;
using Infrastructure.Policies;
using Infrastructure.Projects;
using Infrastructure.Redis;
using Infrastructure.RelayProxies;
using Infrastructure.Resources;
using Infrastructure.Segments;
using Infrastructure.Targeting;
using Infrastructure.Triggers;
using Infrastructure.Users;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;

// ReSharper disable CheckNamespace
namespace Microsoft.Extensions.DependencyInjection;
// ReSharper restore CheckNamespace

public static class ConfigureServices
{
    public static IServiceCollection AddInfrastructureServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // mongodb
        services.Configure<MongoDbOptions>(configuration.GetSection(MongoDbOptions.MongoDb));
        services.AddSingleton<MongoDbClient>();

        // redis
        services.AddSingleton<IRedisClient, DefaultRedisClient>();
        services.AddTransient<ICachePopulatingService, RedisPopulatingService>();
        services.AddTransient<ICacheService, RedisCacheService>();

        // populating cache
        services.AddHostedService<CachePopulatingHostedService>();

        // messaging services
        AddMessagingServices(services, configuration);

        // identity
        services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
        services.AddScoped<IUserStore, MongoDbUserStore>();
        services.AddScoped<IIdentityService, IdentityService>();

        // typed http clients
        services.AddHttpClient<IOlapService, OlapService>(httpClient =>
        {
            httpClient.BaseAddress = new Uri(configuration["OLAP:ServiceHost"]);
        });
        services.AddHttpClient<IAgentService, AgentService>();

        // custom services
        services.AddScoped<IUserService, UserService>();
        services.AddTransient<IOrganizationService, OrganizationService>();
        services.AddTransient<IMemberService, MemberService>();
        services.AddTransient<IProjectService, ProjectService>();
        services.AddTransient<IGroupService, GroupService>();
        services.AddTransient<IPolicyService, PolicyService>();
        services.AddTransient<IEnvironmentService, EnvironmentService>();
        services.AddTransient<IResourceService, ResourceService>();
        services.AddTransient<IEndUserService, EndUserService>();
        services.AddTransient<ISegmentService, SegmentService>();
        services.AddTransient<IFeatureFlagService, FeatureFlagService>();
        services.AddTransient<ITriggerService, TriggerService>();
        services.AddTransient<IDataSyncService, DataSyncService>();
        services.AddTransient<IExperimentService, ExperimentService>();
        services.AddTransient<IExperimentMetricService, ExperimentMetricService>();
        services.AddTransient<IAuditLogService, AuditLogService>();
        services.AddSingleton<IEvaluator, Evaluator>();
        services.AddTransient<IAccessTokenService, AccessTokenService>();
        services.AddTransient<IRelayProxyService, RelayProxyService>();

        return services;
    }

    private static void AddMessagingServices(IServiceCollection services, IConfiguration configuration)
    {
        var isProVersion = configuration["IS_PRO"];
        if (isProVersion.Equals(bool.TrueString, StringComparison.OrdinalIgnoreCase))
        {
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