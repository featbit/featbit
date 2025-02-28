using Domain.Members;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class MemberPolicyConfiguration : IEntityTypeConfiguration<MemberPolicy>
{
    public void Configure(EntityTypeBuilder<MemberPolicy> builder)
    {
        builder.ToTable("member_policies");

        builder.HasIndex(x => new { x.OrganizationId, x.MemberId, x.PolicyId });
    }
}