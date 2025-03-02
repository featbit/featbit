using Domain.AuditLogs;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> builder)
    {
        builder.ToTable("audit_logs");

        builder.HasIndex(x => new { x.EnvId, x.RefId, x.CreatedAt });

        builder.Property(x => x.RefId).IsRequired();
        builder.Property(x => x.RefType).HasMaxLength(64).IsRequired();
        builder.Property(x => x.Keyword).HasMaxLength(128).IsRequired();
        builder.Property(x => x.Operation).HasMaxLength(64).IsRequired();
        builder.Property(x => x.Comment).HasMaxLength(512);
        builder.Property(x => x.CreatedAt).IsRequired();

        builder.Property(x => x.DataChange).HasColumnType("jsonb");
    }
}