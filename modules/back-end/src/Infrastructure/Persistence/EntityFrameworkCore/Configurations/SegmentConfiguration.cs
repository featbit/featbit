using Domain.Segments;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class SegmentConfiguration : IEntityTypeConfiguration<Segment>
{
    public void Configure(EntityTypeBuilder<Segment> builder)
    {
        builder.HasIndex(x => x.WorkspaceId);
        builder.HasIndex(x => x.EnvId);

        builder.Property(x => x.Name).HasMaxLength(255).IsRequired();
        builder.Property(x => x.Type).HasMaxLength(255).IsRequired();
        builder.Property(x => x.IsArchived).IsRequired();
        builder.Property(x => x.Scopes).HasMaxLength(255).IsRequired();
        
        builder.Property(x => x.Rules).HasColumnType("jsonb");
    }
}