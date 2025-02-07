using Domain.Groups;
using Domain.Members;
using Domain.Organizations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class GroupMemberConfiguration : IEntityTypeConfiguration<GroupMember>
{
    public void Configure(EntityTypeBuilder<GroupMember> builder)
    {
        builder.HasOne(typeof(Organization))
            .WithMany()
            .HasForeignKey(nameof(GroupMember.OrganizationId));
        builder.HasOne(typeof(Group))
            .WithMany()
            .HasForeignKey(nameof(GroupMember.GroupId));
        builder.HasOne(typeof(Member))
            .WithMany()
            .HasForeignKey(nameof(GroupMember.MemberId));
    }
}