﻿using Domain.Groups;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class GroupConfiguration : IEntityTypeConfiguration<Group>
{
    
    public void Configure(EntityTypeBuilder<Group> builder)
    {
        builder.HasIndex(x => x.OrganizationId);

        builder.Property(x => x.Name)
            .HasMaxLength(255)
            .IsRequired();
    }
}