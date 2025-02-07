using Domain.FeatureFlags;
using Domain.Organizations;
using Domain.Projects;
using Domain.Users;
using Domain.Workspaces;
using Environment = Domain.Environments.Environment;
using Infrastructure.Persistence.EFCore.Configurations;
using Microsoft.EntityFrameworkCore;
using Domain.EndUsers;
using Domain.Segments;
using Domain.FlagRevisions;
using Domain.FlagDrafts;
using Domain.FlagSchedules;
using Domain.FlagChangeRequests;
using Domain.Triggers;
using Domain.AuditLogs;
using Domain.Groups;
using Domain.Members;
using Domain.Policies;
using Domain.Experiments;
using Domain.ExperimentMetrics;
using Domain.AccessTokens;
using Domain.RelayProxies;
using Domain.Webhooks;

namespace Infrastructure.Persistence.EFCore;

public class AppDbContext : DbContext
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Workspace> Workspaces => Set<Workspace>();
    public DbSet<Organization> Organizations => Set<Organization>();
    public DbSet<OrganizationUser> OrganizationUsers => Set<OrganizationUser>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<Environment> Environments => Set<Environment>();
    public DbSet<EndUser> EndUsers => Set<EndUser>();
    public DbSet<GlobalUser> GlobalUsers => Set<GlobalUser>();
    public DbSet<EndUserProperty> EndUserProperties => Set<EndUserProperty>();
    public DbSet<Segment> Segments => Set<Segment>();
    public DbSet<FeatureFlag> FeatureFlags => Set<FeatureFlag>();
    public DbSet<FlagRevision> FlagRevisions => Set<FlagRevision>();
    public DbSet<FlagDraft> FlagDrafts => Set<FlagDraft>();
    public DbSet<FlagSchedule> FlagSchedules => Set<FlagSchedule>();
    public DbSet<FlagChangeRequest> FlagChangeRequests => Set<FlagChangeRequest>();
    public DbSet<Trigger> Triggers => Set<Trigger>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<Group> Groups => Set<Group>();
    public DbSet<Policy> Policies => Set<Policy>();
    public DbSet<GroupMember> GroupMembers => Set<GroupMember>();
    public DbSet<GroupPolicy> GroupPolicies => Set<GroupPolicy>();
    public DbSet<MemberPolicy> MemberPolicies => Set<MemberPolicy>();

    public DbSet<Experiment> Experiments => Set<Experiment>();
    public DbSet<ExperimentMetric> ExperimentMetrics => Set<ExperimentMetric>();
    public DbSet<AccessToken> AccessTokens => Set<AccessToken>();
    public DbSet<RelayProxy> RelayProxys => Set<RelayProxy>();
    public DbSet<Webhook> Webhooks => Set<Webhook>();
    public DbSet<WebhookDelivery> WebhookDeliveries => Set<WebhookDelivery>();

    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

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
        modelBuilder.ApplyConfiguration(new GlobalUserConfiguration());
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
    }
}