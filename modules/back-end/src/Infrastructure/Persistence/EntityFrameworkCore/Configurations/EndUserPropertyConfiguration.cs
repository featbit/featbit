using Domain.EndUsers;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class EndUserPropertyConfiguration : IEntityTypeConfiguration<EndUserProperty>
{
    public void Configure(EntityTypeBuilder<EndUserProperty> builder)
    {
        builder.HasIndex(x => x.EnvId);

        builder.Property(x => x.Name).HasMaxLength(255).IsRequired();
        builder.Property(x => x.UsePresetValuesOnly).IsRequired();
        builder.Property(x => x.IsBuiltIn).IsRequired();
        builder.Property(x => x.IsDigestField).IsRequired();

        builder.Property(x => x.PresetValues).HasColumnType("jsonb");
    }
}