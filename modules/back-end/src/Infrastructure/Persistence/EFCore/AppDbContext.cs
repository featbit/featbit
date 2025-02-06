using Domain.EndUsers;
using Domain.FeatureFlags;
using Infrastructure.Persistence.EFCore.Configurations;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Persistence.EFCore;

public class AppDbContext : DbContext
{
    public DbSet<FeatureFlag> FeatureFlags => Set<FeatureFlag>();

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
    }
}