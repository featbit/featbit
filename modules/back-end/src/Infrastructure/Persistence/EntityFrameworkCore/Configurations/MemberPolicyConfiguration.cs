﻿using Domain.Members;
using Domain.Organizations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class MemberPolicyConfiguration : IEntityTypeConfiguration<MemberPolicy>
{
    
    public void Configure(EntityTypeBuilder<MemberPolicy> builder)
    {
        builder.HasOne(typeof(Organization))
            .WithMany()
            .HasForeignKey(nameof(MemberPolicy.OrganizationId));
    }
}