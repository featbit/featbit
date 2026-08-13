using Application.Services;
using Infrastructure;
using Infrastructure.Persistence;
using MongoServices = Infrastructure.Services.MongoDb;
using EntityFrameworkCoreServices = Infrastructure.Services.EntityFrameworkCore;

namespace Api.Infrastructure.Persistence;

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
            
            services.AddTransient<ISegmentService, MongoServices.SegmentService>();
            services.AddTransient<IFeatureFlagService, MongoServices.FeatureFlagService>();
            services.AddTransient<IAuditLogService, MongoServices.AuditLogService>();
            services.AddTransient<IFlagDraftService, MongoServices.FlagDraftService>();
            // Required by DcBackfiller.FetchCommittedSnapshotAsync (#91) to enumerate secret caches
            // the same way the api-server's RedisPopulatingService.PopulateSecretsAsync does.
            services.AddTransient<IEnvironmentService, MongoServices.EnvironmentService>();
            // Required by HeartbeatMessageHandler (live-set membership) and the C3b-2 commit
            // coordinator (live-DC enumeration).
            services.AddTransient<global::Application.ControlPlane.ILeaseStore, MongoServices.MongoLeaseStore>();

        }

        void AddEntityFrameworkCoreServices()
        {
            services.TryAddPostgres(configuration);
            services.ConfigureDapper();
            
            services.AddTransient<ISegmentService, EntityFrameworkCoreServices.SegmentService>();
            services.AddTransient<IFeatureFlagService, EntityFrameworkCoreServices.FeatureFlagService>();
            services.AddTransient<IAuditLogService, EntityFrameworkCoreServices.AuditLogService>();
            services.AddTransient<IFlagDraftService, EntityFrameworkCoreServices.FlagDraftService>();
            // Required by DcBackfiller.FetchCommittedSnapshotAsync (#91) to enumerate secret caches
            // the same way the api-server's RedisPopulatingService.PopulateSecretsAsync does.
            services.AddTransient<IEnvironmentService, EntityFrameworkCoreServices.EnvironmentService>();
            // Required by HeartbeatMessageHandler (live-set membership) and the C3b-2 commit
            // coordinator (live-DC enumeration).
            services.AddTransient<global::Application.ControlPlane.ILeaseStore, EntityFrameworkCoreServices.PostgresLeaseStore>();

        }
    }
}