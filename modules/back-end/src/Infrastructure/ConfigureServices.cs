using Application.Caches;
using Confluent.Kafka;
using Domain.Messages;
using Domain.Users;
using Infrastructure;
using Infrastructure.Kafka;
using Infrastructure.Messages;
using Infrastructure.Persistence;
using Infrastructure.Redis;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Services = Infrastructure.Services;
using AppServices = Infrastructure.AppService;
using MongoServices = Infrastructure.Services.MongoDb;
using EntityFrameworkCoreServices = Infrastructure.Services.EntityFrameworkCore;

// ReSharper disable CheckNamespace
namespace Microsoft.Extensions.DependencyInjection;
// ReSharper restore CheckNamespace

public static class ConfigureServices
{
    public static IServiceCollection AddInfrastructureServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
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

        // custom services
        var dbProvider = configuration.GetValue("DbProvider", DbProvider.MongoDb);
        if (dbProvider == DbProvider.MongoDb)
        {
            AddMongoDbServices();
        }
        else
        {
            AddEntityFrameworkCoreServices();
        }

        services.AddHttpClient<IAgentService, Services.AgentService>();
        services.AddHttpClient<IWebhookSender, Services.WebhookSender>();
        services.AddTransient<IEnvironmentAppService, AppServices.EnvironmentAppService>();
        services.AddTransient<IFeatureFlagAppService, AppServices.FeatureFlagAppService>();

        return services;

        void AddMongoDbServices()
        {
            services.Configure<MongoDbOptions>(configuration.GetSection(MongoDbOptions.MongoDb));
            services.AddSingleton<MongoDbClient>();

            services.AddSingleton<IEvaluator, MongoServices.Evaluator>();
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
            services.AddTransient<IInsightService, MongoServices.InsightService>();
        }

        void AddEntityFrameworkCoreServices()
        {
            // ef db context
            var postgresOptions = configuration.GetValue<PostgresOptions>(PostgresOptions.Postgres);
            if (postgresOptions is null)
            {
                throw new InvalidOperationException("Postgres options are not configured");
            }

            services.AddDbContext<AppDbContext>(
                op => op
                    .UseNpgsql(postgresOptions.ConnectionString)
                    .UseSnakeCaseNamingConvention()
                    .UseQueryTrackingBehavior(QueryTrackingBehavior.NoTracking)
            );

            services.AddSingleton<IEvaluator, EntityFrameworkCoreServices.Evaluator>();
            services.AddTransient<IWorkspaceService, EntityFrameworkCoreServices.WorkspaceService>();
            services.AddTransient<IUserService, EntityFrameworkCoreServices.UserService>();
            services.AddTransient<IOrganizationService, EntityFrameworkCoreServices.OrganizationService>();
            services.AddTransient<IMemberService, EntityFrameworkCoreServices.MemberService>();
            services.AddTransient<IProjectService, EntityFrameworkCoreServices.ProjectService>();
            services.AddTransient<IGroupService, EntityFrameworkCoreServices.GroupService>();
            services.AddTransient<IPolicyService, EntityFrameworkCoreServices.PolicyService>();
            services.AddTransient<IEnvironmentService, EntityFrameworkCoreServices.EnvironmentService>();
            services.AddTransient<IResourceService, EntityFrameworkCoreServices.ResourceService>();
            services.AddTransient<IResourceServiceV2, EntityFrameworkCoreServices.ResourceServiceV2>();
            services.AddTransient<IEndUserService, EntityFrameworkCoreServices.EndUserService>();
            services.AddTransient<IGlobalUserService, EntityFrameworkCoreServices.GlobalUserService>();
            services.AddTransient<ISegmentService, EntityFrameworkCoreServices.SegmentService>();
            services.AddTransient<IFeatureFlagService, EntityFrameworkCoreServices.FeatureFlagService>();
            services.AddTransient<ITriggerService, EntityFrameworkCoreServices.TriggerService>();
            services.AddTransient<IExperimentService, EntityFrameworkCoreServices.ExperimentService>();
            services.AddTransient<IExperimentMetricService, EntityFrameworkCoreServices.ExperimentMetricService>();
            services.AddTransient<IAuditLogService, EntityFrameworkCoreServices.AuditLogService>();
            services.AddTransient<IAccessTokenService, EntityFrameworkCoreServices.AccessTokenService>();
            services.AddTransient<IRelayProxyService, EntityFrameworkCoreServices.RelayProxyService>();
            services.AddTransient<IFlagDraftService, EntityFrameworkCoreServices.FlagDraftService>();
            services.AddTransient<IFlagScheduleService, EntityFrameworkCoreServices.FlagScheduleService>();
            services.AddTransient<IFlagRevisionService, EntityFrameworkCoreServices.FlagRevisionService>();
            services.AddTransient<IFlagChangeRequestService, EntityFrameworkCoreServices.FlagChangeRequestService>();
            services.AddTransient<IWebhookService, EntityFrameworkCoreServices.WebhookService>();
            services.AddTransient<IInsightService, EntityFrameworkCoreServices.InsightService>();
        }

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