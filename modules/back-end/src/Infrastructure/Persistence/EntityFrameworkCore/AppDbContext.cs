using Infrastructure.Persistence.EntityFrameworkCore.Configurations;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Persistence.EntityFrameworkCore;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.ApplyConfiguration(new UserConfiguration());
        modelBuilder.ApplyConfiguration(new RefreshTokenConfiguration());
        modelBuilder.ApplyConfiguration(new WorkspaceConfiguration());
        modelBuilder.ApplyConfiguration(new WorkspaceUserConfiguration());
        modelBuilder.ApplyConfiguration(new OrganizationConfiguration());
        modelBuilder.ApplyConfiguration(new OrganizationUserConfiguration());
        modelBuilder.ApplyConfiguration(new ProjectConfiguration());
        modelBuilder.ApplyConfiguration(new EnvironmentConfiguration());
        modelBuilder.ApplyConfiguration(new EndUserConfiguration());
        modelBuilder.ApplyConfiguration(new EndUserPropertyConfiguration());
        modelBuilder.ApplyConfiguration(new SegmentConfiguration());
        modelBuilder.ApplyConfiguration(new FeatureFlagConfiguration());
        modelBuilder.ApplyConfiguration(new FlagRevisionConfiguration());
        modelBuilder.ApplyConfiguration(new FlagDraftConfiguration());
        modelBuilder.ApplyConfiguration(new FlagScheduleConfiguration());
        modelBuilder.ApplyConfiguration(new FlagChangeRequestConfiguration());
        modelBuilder.ApplyConfiguration(new TriggerConfiguration());

        modelBuilder.ApplyConfiguration(new AuditLogConfiguration());
        modelBuilder.ApplyConfiguration(new GroupConfiguration());
        modelBuilder.ApplyConfiguration(new PolicyConfiguration());
        modelBuilder.ApplyConfiguration(new GroupMemberConfiguration());
        modelBuilder.ApplyConfiguration(new GroupPolicyConfiguration());
        modelBuilder.ApplyConfiguration(new MemberPolicyConfiguration());

        modelBuilder.ApplyConfiguration(new ReleaseDecisionExperimentConfiguration());
        modelBuilder.ApplyConfiguration(new ReleaseDecisionExperimentRunConfiguration());
        modelBuilder.ApplyConfiguration(new ReleaseDecisionActivityConfiguration());
        modelBuilder.ApplyConfiguration(new ReleaseDecisionExposureEventConfiguration());
        modelBuilder.ApplyConfiguration(new ReleaseDecisionMetricEventConfiguration());
        modelBuilder.ApplyConfiguration(new ReleaseDecisionRunAssignmentConfiguration());
        modelBuilder.ApplyConfiguration(new AccessTokenConfiguration());
        modelBuilder.ApplyConfiguration(new McpDeviceAuthorizationConfiguration());
        modelBuilder.ApplyConfiguration(new McpRefreshAuthorizationConfiguration());
        modelBuilder.ApplyConfiguration(new McpAccessTokenSessionConfiguration());
        modelBuilder.ApplyConfiguration(new RelayProxyConfiguration());
        modelBuilder.ApplyConfiguration(new WebhookConfiguration());
        modelBuilder.ApplyConfiguration(new WebhookDeliveryConfiguration());
        modelBuilder.ApplyConfiguration(new QueueMessageConfiguration());
    }
}
