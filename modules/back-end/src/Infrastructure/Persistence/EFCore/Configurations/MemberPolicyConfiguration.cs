using Domain.Members;
using Domain.Organizations;
using Domain.Policies;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EFCore.Configurations;

public class MemberPolicyConfiguration : IEntityTypeConfiguration<MemberPolicy>
{
    
    public void Configure(EntityTypeBuilder<MemberPolicy> builder)
    {
        builder.HasOne(typeof(Organization))
            .WithMany()
            .HasForeignKey(nameof(MemberPolicy.OrganizationId));
        builder.HasOne(typeof(Member))
            .WithMany()
            .HasForeignKey(nameof(MemberPolicy.MemberId));
        builder.HasOne(typeof(Policy))
            .WithMany()
            .HasForeignKey(nameof(MemberPolicy.PolicyId));
    }
}