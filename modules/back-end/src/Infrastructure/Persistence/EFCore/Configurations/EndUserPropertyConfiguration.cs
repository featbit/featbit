using Domain.EndUsers;
using Domain.Workspaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EFCore.Configurations;

public class EndUserPropertyConfiguration : IEntityTypeConfiguration<EndUserProperty>
{
    public void Configure(EntityTypeBuilder<EndUserProperty> builder)
    {
        builder.HasOne(typeof(Environment))
            .WithMany()
            .HasForeignKey(nameof(EndUserProperty.EnvId));

        builder.Property(x => x.PresetValues).HasColumnType("jsonb");
    }
}