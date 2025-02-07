using Application.Caches;
using Confluent.Kafka;
using Domain.Messages;
using Domain.Users;
using Infrastructure;
using Infrastructure.Kafka;
using Infrastructure.Messages;
using Infrastructure.Redis;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using AppServices = Infrastructure.AppService;
using Services = Infrastructure.Services;
using MongoServices = Infrastructure.Services.MongoDb;

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

        // ef db context
        services.AddDbContext<AppDbContext>(
            op => op
                .UseNpgsql("Host=localhost;Username=postgres;Password=123456;Database=featbit")
                .UseSnakeCaseNamingConvention()
        );

        // redis
        services.AddSingleton<IRedisClient, DefaultRedisClient>();
        services.AddTransient<ICachePopulatingService, RedisPopulatingService>();
        services.AddTransient<ICacheService, RedisCacheService>();

        // populating cache
        services.AddHostedService<CachePopulatingHostedService>();

        // flag schedule worker
        services.AddHostedService<AppServices.FlagScheduleWorker>();

        // messaging services
        AddMessagingServices();

        // identity
        services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
        services.AddScoped<IIdentityService, Services.IdentityService>();

        // typed http clients
        services.AddHttpClient<IOlapService, Services.OlapService>(httpClient =>
        {
            httpClient.BaseAddress = new Uri(configuration["OLAP:ServiceHost"]!);
        });
        services.AddHttpClient<IAgentService, Services.AgentService>();
        services.AddHttpClient<IWebhookSender, Services.WebhookSender>();
        services.AddSingleton<IEvaluator, Services.Evaluator>();

        // custom services
        services.AddTransient<IWorkspaceService, MongoServices.WorkspaceService>();
        services.AddTransient<IUserService, MongoServices.UserService>();
        services.AddTransient<IOrganizationService, MongoServices.OrganizationService>();
        services.AddTransient<IMemberService, MongoServices.MemberService>();
        services.AddTransient<IProjectService, MongoServices.ProjectService>();
        services.AddTransient<IGroupService, MongoServices.GroupService>();
        services.AddTransient<IPolicyService, MongoServices.PolicyService>();
        services.AddTransient<IEnvironmentService, MongoServices.EnvironmentService>();
        services.AddTransient<IResourceService, MongoServices.ResourceService>();
        services.AddTransient<IResourceServiceV2, MongoServices.ResourceServiceV2>();
        services.AddTransient<IEndUserService, MongoServices.EndUserService>();
        services.AddTransient<IGlobalUserService, MongoServices.GlobalUserService>();
        services.AddTransient<ISegmentService, MongoServices.SegmentService>();
        services.AddTransient<IFeatureFlagService, MongoServices.FeatureFlagService>();
        services.AddTransient<ITriggerService, MongoServices.TriggerService>();
        services.AddTransient<IExperimentService, MongoServices.ExperimentService>();
        services.AddTransient<IExperimentMetricService, MongoServices.ExperimentMetricService>();
        services.AddTransient<IAuditLogService, MongoServices.AuditLogService>();
        services.AddTransient<IAccessTokenService, MongoServices.AccessTokenService>();
        services.AddTransient<IRelayProxyService, MongoServices.RelayProxyService>();
        services.AddTransient<IFlagDraftService, MongoServices.FlagDraftService>();
        services.AddTransient<IFlagScheduleService, MongoServices.FlagScheduleService>();
        services.AddTransient<IFlagRevisionService, MongoServices.FlagRevisionService>();
        services.AddTransient<IFlagChangeRequestService, MongoServices.FlagChangeRequestService>();
        services.AddTransient<IWebhookService, MongoServices.WebhookService>();

        // app services
        services.AddTransient<IEnvironmentAppService, AppServices.EnvironmentAppService>();
        services.AddTransient<ISegmentAppService, AppServices.SegmentAppService>();
        services.AddTransient<IFeatureFlagAppService, AppServices.FeatureFlagAppService>();

        return services;

        void AddMessagingServices()
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
}