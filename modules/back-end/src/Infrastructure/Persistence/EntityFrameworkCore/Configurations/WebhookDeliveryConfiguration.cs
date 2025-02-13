using Domain.Webhooks;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class WebhookDeliveryConfiguration : IEntityTypeConfiguration<WebhookDelivery>
{
    public void Configure(EntityTypeBuilder<WebhookDelivery> builder)
    {
        builder.ToTable("webhook_deliveries");

        builder.HasIndex(x => x.WebhookId);

        builder.Property(x => x.Request).HasColumnType("jsonb");
        builder.Property(x => x.Response).HasColumnType("jsonb");
        builder.Property(x => x.Error).HasColumnType("jsonb");
    }
}