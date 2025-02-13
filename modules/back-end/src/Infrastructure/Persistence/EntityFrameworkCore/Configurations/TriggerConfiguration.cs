﻿using Domain.Triggers;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class TriggerConfiguration : IEntityTypeConfiguration<Trigger>
{
    public void Configure(EntityTypeBuilder<Trigger> builder)
    {
        builder.HasIndex(x => x.TargetId);

        builder.Property(x => x.Type)
            .HasMaxLength(255)
            .IsRequired();
        builder.Property(x => x.Action)
            .HasMaxLength(255)
            .IsRequired();
        builder.Property(x => x.Token)
            .HasMaxLength(255);
        builder.Property(x => x.IsEnabled)
            .IsRequired();

    }
}