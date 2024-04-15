using Application.Caches;
using Confluent.Kafka;
using Domain.Messages;
using Domain.Users;
using Infrastructure.AccessTokens;
using Infrastructure.Workspaces;
using Infrastructure.AuditLogs;
using Infrastructure.DataSync;
using Infrastructure.EndUsers;
using Infrastructure.Environments;
using Infrastructure.ExperimentMetrics;
using Infrastructure.Experiments;
using Infrastructure.FeatureFlags;
using Infrastructure.FlagChangeRequests;
using Infrastructure.FlagDrafts;
using Infrastructure.FlagRevisions;
using Infrastructure.FlagSchedules;
using Infrastructure.GlobalUsers;
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
using Infrastructure.Webhooks;
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

        // flag schedule worker
        services.AddHostedService<FlagScheduleWorker>();

        // messaging services
        AddMessagingServices(services, configuration);

        // identity
        services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
        services.AddScoped<IIdentityService, IdentityService>();

        // typed http clients
        services.AddHttpClient<IOlapService, OlapService>(httpClient =>
        {
            httpClient.BaseAddress = new Uri(configuration["OLAP:ServiceHost"]);
        });
        services.AddHttpClient<IAgentService, AgentService>();
        services.AddHttpClient<IWebhookSender, WebhookSender>();

        // custom services
        services.AddTransient<IWorkspaceService, WorkspaceService>();
        services.AddTransient<IUserService, UserService>();
        services.AddTransient<IOrganizationService, OrganizationService>();
        services.AddTransient<IMemberService, MemberService>();
        services.AddTransient<IProjectService, ProjectService>();
        services.AddTransient<IGroupService, GroupService>();
        services.AddTransient<IPolicyService, PolicyService>();
        services.AddTransient<IEnvironmentService, EnvironmentService>();
        services.AddTransient<IResourceService, ResourceService>();
        services.AddTransient<IResourceServiceV2, ResourceServiceV2>();
        services.AddTransient<IEndUserService, EndUserService>();
        services.AddTransient<IGlobalUserService, GlobalUserService>();
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
        services.AddTransient<IFlagDraftService, FlagDraftService>();
        services.AddTransient<IFlagScheduleService, FlagScheduleService>();
        services.AddTransient<IFlagRevisionService, FlagRevisionService>();
        services.AddTransient<IFlagChangeRequestService, FlagChangeRequestService>();
        services.AddTransient<IFeatureFlagAppService, FeatureFlagAppService>();
        services.AddTransient<IWebhookService, WebhookService>();

        return services;
    }

    private static void AddMessagingServices(IServiceCollection services, IConfiguration configuration)
    {
        var isProVersion = configuration["IS_PRO"];
        if (isProVersion.Equals(bool.TrueString, StringComparison.OrdinalIgnoreCase))
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