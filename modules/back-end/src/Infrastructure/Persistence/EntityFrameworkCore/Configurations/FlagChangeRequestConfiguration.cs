using Domain.FlagChangeRequests;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class FlagChangeRequestConfiguration : IEntityTypeConfiguration<FlagChangeRequest>
{
    public void Configure(EntityTypeBuilder<FlagChangeRequest> builder)
    {
        builder.HasIndex(x => x.OrgId);
        builder.HasIndex(x => x.EnvId);

        builder.Property(x => x.Status)
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(x => x.Reviewers).HasColumnType("jsonb");
    }
}