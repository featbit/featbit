using Domain.FeatureFlags;
using Domain.Triggers;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EFCore.Configurations;

public class TriggerConfiguration : IEntityTypeConfiguration<Trigger>
{
    public void Configure(EntityTypeBuilder<Trigger> builder)
    {
        builder.HasOne(typeof(FeatureFlag))
            .WithMany()
            .HasForeignKey(nameof(Trigger.TargetId));

        builder.Property(x => x.Type)
            .HasMaxLength(255)
            .IsRequired();
        builder.Property(x => x.Action)
            .HasMaxLength(255)
            .IsRequired();
        builder.Property(x => x.Token)
            .HasMaxLength(255);
        builder.Property(x => x.IsEnabled)
            .IsRequired();

    }
}