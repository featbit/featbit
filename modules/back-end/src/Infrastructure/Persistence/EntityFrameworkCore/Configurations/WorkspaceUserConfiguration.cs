using Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class WorkspaceUserConfiguration : IEntityTypeConfiguration<WorkspaceUser>
{
    public void Configure(EntityTypeBuilder<WorkspaceUser> builder)
    {
        builder.ToTable("workspace_users");

        builder.HasIndex(x => new { x.WorkspaceId, x.UserId }).IsUnique();;
    }
}