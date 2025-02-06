using Domain.FeatureFlags;
using Domain.FlagDrafts;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EFCore.Configurations;

public class FlagDraftConfiguration : IEntityTypeConfiguration<FlagDraft>
{
    
    public void Configure(EntityTypeBuilder<FlagDraft> builder)
    {
        builder.HasOne(typeof(Domain.Environments.Environment))
            .WithMany()
            .HasForeignKey(nameof(FlagDraft.EnvId));
        builder.HasOne(typeof(FeatureFlag))
            .WithMany()
            .HasForeignKey(nameof(FlagDraft.FlagId));

        builder.Property(x => x.Status)
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(x => x.DataChange).HasColumnType("jsonb");
    }
}