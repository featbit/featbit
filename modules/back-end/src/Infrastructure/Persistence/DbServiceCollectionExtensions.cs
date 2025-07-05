using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using MongoServices = Infrastructure.Services.MongoDb;
using EntityFrameworkCoreServices = Infrastructure.Services.EntityFrameworkCore;

namespace Infrastructure.Persistence;

public static class DbServiceCollectionExtensions
{
    public static void AddDbSpecificServices(this IServiceCollection services, IConfiguration configuration)
    {
        var dbProvider = configuration.GetDbProvider();

        switch (dbProvider.Name)
        {
            case DbProvider.MongoDb:
                AddMongoDbServices();
                break;

            case DbProvider.Postgres:
                AddEntityFrameworkCoreServices();
                break;
        }

        return;

        void AddMongoDbServices()
        {
            services.TryAddMongoDb(configuration);

            services.AddTransient<IWebhookHandler, Services.WebhookHandler>();

            services.AddTransient<IEvaluator, MongoServices.Evaluator>();
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
            services.TryAddPostgres(configuration);
            services.ConfigureDapper();

            services.AddTransient<IGeneralWebhookHandler, Services.WebhookHandler>();
            services.AddTransient<IScopedWebhookHandler, Services.ScopedWebhookHandler>();
            services.AddTransient<IWebhookHandler>(x => x.GetRequiredService<IScopedWebhookHandler>());

            services.AddTransient<IEvaluator, EntityFrameworkCoreServices.Evaluator>();
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
    }
}