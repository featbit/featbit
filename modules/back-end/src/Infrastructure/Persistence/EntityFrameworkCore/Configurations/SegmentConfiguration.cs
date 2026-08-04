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
        builder.Property(x => x.Key).HasMaxLength(128).IsRequired();
        builder.Property(x => x.Type).HasMaxLength(64).IsRequired();
        builder.Property(x => x.Description).HasMaxLength(512);
        builder.Property(x => x.IsArchived).IsRequired();

        builder.Property(x => x.Rules).HasColumnType("jsonb");

        // Committed-vs-pending (parity with the Mongo path). CommittedVersion is a plain
        // bigint column; Pending is a complex object stored as jsonb, mirroring how the
        // other complex properties above (Rules) are persisted.
        builder.Property(x => x.CommittedVersion).IsRequired();
        builder.Property(x => x.Pending).HasColumnType("jsonb");

        // Postgres xmin as an optimistic concurrency token (#72): changes on every row
        // update, so a racing writer makes SaveChanges throw DbUpdateConcurrencyException
        // instead of silently overwriting. System column - no DDL, Mongo unaffected.
        builder.Property<uint>("xmin").IsRowVersion();
    }
}