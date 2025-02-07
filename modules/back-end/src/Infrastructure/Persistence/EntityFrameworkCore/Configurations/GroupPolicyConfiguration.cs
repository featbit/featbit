using Domain.Groups;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class GroupPolicyConfiguration : IEntityTypeConfiguration<GroupPolicy>
{
    public void Configure(EntityTypeBuilder<GroupPolicy> builder)
    {
        builder.HasOne(typeof(Group))
            .WithMany()
            .HasForeignKey(nameof(GroupPolicy.GroupId));
    }
}