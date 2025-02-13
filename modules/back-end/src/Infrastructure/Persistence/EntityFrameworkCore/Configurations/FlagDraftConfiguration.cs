using Domain.FlagDrafts;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class FlagDraftConfiguration : IEntityTypeConfiguration<FlagDraft>
{
    
    public void Configure(EntityTypeBuilder<FlagDraft> builder)
    {
        builder.HasIndex(x => x.EnvId);

        builder.Property(x => x.Status)
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(x => x.DataChange).HasColumnType("jsonb");
    }
}