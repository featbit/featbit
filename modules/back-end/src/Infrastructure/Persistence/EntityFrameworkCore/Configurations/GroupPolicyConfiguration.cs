using Domain.Groups;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class GroupPolicyConfiguration : IEntityTypeConfiguration<GroupPolicy>
{
    public void Configure(EntityTypeBuilder<GroupPolicy> builder)
    {
        builder.ToTable("group_policies");

        builder.HasIndex(x => new { x.GroupId, x.PolicyId });
    }
}