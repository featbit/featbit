﻿using Amazon.Auth.AccessControlPolicy;
using Domain.Groups;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EFCore.Configurations;

public class GroupPolicyConfiguration : IEntityTypeConfiguration<GroupPolicy>
{
    public void Configure(EntityTypeBuilder<GroupPolicy> builder)
    {
        builder.HasOne(typeof(Group))
            .WithMany()
            .HasForeignKey(nameof(GroupPolicy.GroupId));
        builder.HasOne(typeof(Domain.Policies.Policy))
            .WithMany()
            .HasForeignKey(nameof(GroupPolicy.PolicyId));
    }
}