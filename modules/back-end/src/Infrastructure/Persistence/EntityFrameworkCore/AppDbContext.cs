using Infrastructure.Persistence.EntityFrameworkCore.Configurations;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Persistence.EntityFrameworkCore;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.ApplyConfiguration(new UserConfiguration());
        modelBuilder.ApplyConfiguration(new WorkspaceConfiguration());
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

        modelBuilder.ApplyConfiguration(new ExperimentConfiguration());
        modelBuilder.ApplyConfiguration(new ExperimentMetricConfiguration());
        modelBuilder.ApplyConfiguration(new AccessTokenConfiguration());
        modelBuilder.ApplyConfiguration(new RelayProxyConfiguration());
        modelBuilder.ApplyConfiguration(new WebhookConfiguration());
        modelBuilder.ApplyConfiguration(new WebhookDeliveryConfiguration());
        modelBuilder.ApplyConfiguration(new QueueMessageConfiguration());
    }
}