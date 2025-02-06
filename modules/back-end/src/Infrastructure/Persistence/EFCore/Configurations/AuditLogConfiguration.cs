using Domain.AuditLogs;
using Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EFCore.Configurations;

public class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    
    public void Configure(EntityTypeBuilder<AuditLog> builder)
    {
        builder.HasOne(typeof(Environment))
            .WithMany()
            .HasForeignKey(nameof(AuditLog.EnvId));
        builder.HasOne(typeof(User))
            .WithMany()
            .HasForeignKey(nameof(AuditLog.CreatorId));

        builder.HasIndex(x => x.RefId);
        builder.HasIndex(x => x.RefType);

        builder.Property(x => x.RefId)
               .HasMaxLength(255)
               .IsRequired();
        builder.Property(x => x.RefType)
               .HasMaxLength(255)
               .IsRequired();
        builder.Property(x => x.Keyword)
               .HasMaxLength(255);
        builder.Property(x => x.Operation)
               .HasMaxLength(255)
               .IsRequired();
        builder.Property(x => x.CreatedAt)
               .IsRequired();

        builder.Property(x => x.DataChange).HasColumnType("jsonb");
    }
}