using Domain.FeatureFlags;
using Domain.FlagDrafts;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class FlagDraftConfiguration : IEntityTypeConfiguration<FlagDraft>
{
    
    public void Configure(EntityTypeBuilder<FlagDraft> builder)
    {
        builder.HasOne(typeof(Domain.Environments.Environment))
            .WithMany()
            .HasForeignKey(nameof(FlagDraft.EnvId));

        builder.Property(x => x.Status)
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(x => x.DataChange).HasColumnType("jsonb");
    }
}