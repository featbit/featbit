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

        modelBuilder.ApplyConfiguration(new WorkspaceConfiguration());
        modelBuilder.ApplyConfiguration(new OrganizationConfiguration());
        modelBuilder.ApplyConfiguration(new ProjectConfiguration());
        modelBuilder.ApplyConfiguration(new EnvironmentConfiguration());

        modelBuilder.ApplyConfiguration(new FeatureFlagConfiguration());
    }
}