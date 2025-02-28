using System.Text.Json;
using Domain.Utils;
using Domain.Webhooks;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class WebhookDeliveryConfiguration : IEntityTypeConfiguration<WebhookDelivery>
{
    public void Configure(EntityTypeBuilder<WebhookDelivery> builder)
    {
        builder.ToTable("webhook_deliveries");

        builder.HasIndex(x => new { x.WebhookId, x.StartedAt });

        var converter = new ValueConverter<object, string>(
            v => JsonSerializer.Serialize(v, ReusableJsonSerializerOptions.Web),
            v => JsonSerializer.Deserialize<object>(v, ReusableJsonSerializerOptions.Web) ?? new object()
        );

        builder.Property(x => x.Request).HasColumnType("jsonb").HasConversion(converter);
        builder.Property(x => x.Response).HasColumnType("jsonb").HasConversion(converter);
        builder.Property(x => x.Error).HasColumnType("jsonb").HasConversion(converter);
    }
}