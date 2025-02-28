using Domain.Webhooks;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class WebhookConfiguration : IEntityTypeConfiguration<Webhook>
{
    public void Configure(EntityTypeBuilder<Webhook> builder)
    {
        builder.ToTable("webhooks");

        builder.HasIndex(x => new { x.OrgId, x.CreatedAt });

        builder.Property(x => x.Name).HasMaxLength(128).IsRequired();
        builder.Property(x => x.Url).IsRequired();
        builder.Property(x => x.PayloadTemplateType).HasMaxLength(64);
        builder.Property(x => x.IsActive).IsRequired();
        builder.Property(x => x.PreventEmptyPayloads).IsRequired();

        builder.Property(x => x.Headers).HasColumnType("jsonb");
        builder.Property(x => x.LastDelivery).HasColumnType("jsonb");
    }
}