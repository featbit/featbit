using Domain.Segments;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class SegmentConfiguration : IEntityTypeConfiguration<Segment>
{
    public void Configure(EntityTypeBuilder<Segment> builder)
    {
        builder.ToTable("segments");

        builder.HasIndex(x => new { x.WorkspaceId, x.UpdatedAt });

        builder.Property(x => x.Name).HasMaxLength(128).IsRequired();
        builder.Property(x => x.Type).HasMaxLength(64).IsRequired();
        builder.Property(x => x.Description).HasMaxLength(512);
        builder.Property(x => x.IsArchived).IsRequired();

        builder.Property(x => x.Rules).HasColumnType("jsonb");
    }
}