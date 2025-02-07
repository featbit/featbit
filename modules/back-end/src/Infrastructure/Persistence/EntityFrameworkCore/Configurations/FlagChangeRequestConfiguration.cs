﻿using Domain.FeatureFlags;
using Domain.FlagChangeRequests;
using Domain.FlagDrafts;
using Domain.Organizations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class FlagChangeRequestConfiguration : IEntityTypeConfiguration<FlagChangeRequest>
{
    public void Configure(EntityTypeBuilder<FlagChangeRequest> builder)
    {
        builder.HasOne(typeof(Organization))
            .WithMany()
            .HasForeignKey(nameof(FlagChangeRequest.OrgId));
        builder.HasOne(typeof(Domain.Environments.Environment))
            .WithMany()
            .HasForeignKey(nameof(FlagChangeRequest.EnvId));

        builder.Property(x => x.Status)
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(x => x.Reviewers).HasColumnType("jsonb");
    }
}