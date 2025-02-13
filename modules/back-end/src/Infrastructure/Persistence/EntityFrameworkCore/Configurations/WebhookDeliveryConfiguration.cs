using Domain.Webhooks;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class WebhookDeliveryConfiguration : IEntityTypeConfiguration<WebhookDelivery>
{
    public void Configure(EntityTypeBuilder<WebhookDelivery> builder)
    {
        builder.HasIndex(x => x.WebhookId);

        builder.Property(x => x.Success).IsRequired();
        builder.Property(x => x.StartedAt).IsRequired();
        builder.Property(x => x.EndedAt).IsRequired();

        builder.Property(x => x.Request).HasColumnType("jsonb");
        builder.Property(x => x.Response).HasColumnType("jsonb");
        builder.Property(x => x.Error).HasColumnType("jsonb");
    }
}