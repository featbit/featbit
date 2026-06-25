using Domain.Mcp;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class McpDeviceAuthorizationConfiguration : IEntityTypeConfiguration<McpDeviceAuthorization>
{
    public void Configure(EntityTypeBuilder<McpDeviceAuthorization> builder)
    {
        builder.ToTable("mcp_device_authorizations");

        builder.HasIndex(x => x.DeviceCodeHash).IsUnique();
        builder.HasIndex(x => x.UserCode).IsUnique();
        builder.HasIndex(x => x.ExpiresAt);

        builder.Property(x => x.ClientId).HasMaxLength(256).IsRequired();
        builder.Property(x => x.DeviceCodeHash).HasMaxLength(64).IsRequired();
        builder.Property(x => x.UserCode).HasMaxLength(16).IsRequired();
        builder.Property(x => x.EnvId).IsRequired();
        builder.Property(x => x.ExpiresAt).IsRequired();
        builder.Property(x => x.IsApproved).IsRequired();
    }
}

public class McpRefreshAuthorizationConfiguration : IEntityTypeConfiguration<McpRefreshAuthorization>
{
    public void Configure(EntityTypeBuilder<McpRefreshAuthorization> builder)
    {
        builder.ToTable("mcp_refresh_authorizations");

        builder.HasIndex(x => x.TokenHash).IsUnique();
        builder.HasIndex(x => x.ExpiresAt);

        builder.Property(x => x.TokenHash).HasMaxLength(64).IsRequired();
        builder.Property(x => x.ClientId).HasMaxLength(256).IsRequired();
        builder.Property(x => x.UserId).IsRequired();
        builder.Property(x => x.OrganizationId).IsRequired();
        builder.Property(x => x.WorkspaceId).IsRequired();
        builder.Property(x => x.EnvId).IsRequired();
        builder.Property(x => x.ExpiresAt).IsRequired();
    }
}

public class McpAccessTokenSessionConfiguration : IEntityTypeConfiguration<McpAccessTokenSession>
{
    public void Configure(EntityTypeBuilder<McpAccessTokenSession> builder)
    {
        builder.ToTable("mcp_access_token_sessions");

        builder.HasIndex(x => x.TokenId).IsUnique();
        builder.HasIndex(x => x.ExpiresAt);
        builder.HasIndex(x => x.RevokedAt);

        builder.Property(x => x.TokenId).HasMaxLength(128).IsRequired();
        builder.Property(x => x.ClientId).HasMaxLength(256).IsRequired();
        builder.Property(x => x.UserId).IsRequired();
        builder.Property(x => x.OrganizationId).IsRequired();
        builder.Property(x => x.WorkspaceId).IsRequired();
        builder.Property(x => x.ExpiresAt).IsRequired();
    }
}
