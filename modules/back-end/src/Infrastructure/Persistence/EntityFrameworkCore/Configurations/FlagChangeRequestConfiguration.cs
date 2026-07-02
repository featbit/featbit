using Domain.FlagChangeRequests;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class FlagChangeRequestConfiguration : IEntityTypeConfiguration<FlagChangeRequest>
{
    public void Configure(EntityTypeBuilder<FlagChangeRequest> builder)
    {
        builder.ToTable("flag_change_requests");

        builder.HasIndex(x => x.FlagId);

        builder.Property(x => x.Status).HasMaxLength(64).IsRequired();
        builder.Property(x => x.Reason).HasMaxLength(512);

        builder.Property(x => x.Reviewers).HasColumnType("jsonb");
    }
}