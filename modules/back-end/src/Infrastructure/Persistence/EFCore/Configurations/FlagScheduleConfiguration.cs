﻿using Domain.FeatureFlags;
using Domain.FlagDrafts;
using Domain.FlagSchedules;
using Domain.Organizations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EFCore.Configurations;

public class FlagScheduleConfiguration : IEntityTypeConfiguration<FlagSchedule>
{   
    public void Configure(EntityTypeBuilder<FlagSchedule> builder)
    {
        builder.HasOne(typeof(Organization))
            .WithMany()
            .HasForeignKey(nameof(FlagSchedule.OrgId));
        builder.HasOne(typeof(Environment))
            .WithMany()
            .HasForeignKey(nameof(FlagSchedule.EnvId));
        builder.HasOne(typeof(FeatureFlag))
            .WithMany()
            .HasForeignKey(nameof(FlagSchedule.FlagId));
        builder.HasOne(typeof(FlagDraft))
            .WithOne()
            .HasForeignKey(nameof(FlagSchedule.FlagDraftId));

        builder.Property(x => x.Status)
            .HasMaxLength(255)
            .IsRequired();
        builder.Property(x => x.Title)
            .HasMaxLength(255)
            .IsRequired();
        builder.Property(x => x.ScheduledTime)
            .IsRequired();
    }
}