using Domain.FlagDrafts;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class FlagDraftConfiguration : IEntityTypeConfiguration<FlagDraft>
{
    public void Configure(EntityTypeBuilder<FlagDraft> builder)
    {
        builder.ToTable("flag_drafts");

        builder.Property(x => x.Status).HasMaxLength(64).IsRequired();
        builder.Property(x => x.Comment).HasMaxLength(512);

        builder.Property(x => x.DataChange).HasColumnType("jsonb");
    }
}