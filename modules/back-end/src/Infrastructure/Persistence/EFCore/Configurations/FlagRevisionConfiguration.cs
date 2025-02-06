using Domain.FlagRevisions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EFCore.Configurations;

public class FlagRevisionConfiguration : IEntityTypeConfiguration<FlagRevision>
{
    
    public void Configure(EntityTypeBuilder<FlagRevision> builder)
    {
        builder.Property(x => x.Flag).HasColumnType("jsonb");
    }
}