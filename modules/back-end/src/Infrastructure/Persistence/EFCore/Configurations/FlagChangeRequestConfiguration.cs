using Domain.FeatureFlags;
using Domain.FlagChangeRequests;
using Domain.FlagDrafts;
using Domain.Organizations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EFCore.Configurations;

public class FlagChangeRequestConfiguration : IEntityTypeConfiguration<FlagChangeRequest>
{
    
    public void Configure(EntityTypeBuilder<FlagChangeRequest> builder)
    {
        builder.HasOne(typeof(Organization))
            .WithMany()
            .HasForeignKey(nameof(FlagChangeRequest.OrgId));
        builder.HasOne(typeof(Environment))
            .WithMany()
            .HasForeignKey(nameof(FlagChangeRequest.EnvId));
        builder.HasOne(typeof(FlagDraft))
            .WithMany()
            .HasForeignKey(nameof(FlagChangeRequest.FlagDraftId));
        builder.HasOne(typeof(FeatureFlag))
            .WithMany()
            .HasForeignKey(nameof(FlagChangeRequest.FlagId));

        builder.Property(x => x.Status)
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(x => x.Reviewers).HasColumnType("jsonb");
    }
}