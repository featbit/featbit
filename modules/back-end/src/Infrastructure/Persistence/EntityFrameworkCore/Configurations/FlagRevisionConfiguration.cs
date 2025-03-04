using Domain.FlagRevisions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class FlagRevisionConfiguration : IEntityTypeConfiguration<FlagRevision>
{
    public void Configure(EntityTypeBuilder<FlagRevision> builder)
    {
        builder.ToTable("flag_revisions");

        builder.Property(x => x.Flag).HasColumnType("jsonb");
        builder.Property(x => x.Comment).HasMaxLength(512);
    }
}