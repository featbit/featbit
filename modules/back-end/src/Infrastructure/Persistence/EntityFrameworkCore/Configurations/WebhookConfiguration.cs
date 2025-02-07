using Domain.Organizations;
using Domain.Users;
using Domain.Webhooks;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class WebhookConfiguration : IEntityTypeConfiguration<Webhook>
{
    public void Configure(EntityTypeBuilder<Webhook> builder)
    {
        builder.HasOne(typeof(Organization))
            .WithMany()
            .HasForeignKey(nameof(Webhook.OrgId));

        builder.Property(x => x.Name)
            .HasMaxLength(255)
            .IsRequired();
        builder.Property(x => x.Url)
            .IsRequired();
        builder.Property(x => x.PayloadTemplateType)
            .HasMaxLength(255);
        builder.Property(x => x.IsActive)
            .IsRequired();
        builder.Property(x => x.PreventEmptyPayloads)
            .IsRequired();

        builder.Property(x => x.Headers).HasColumnType("jsonb");
        builder.Property(x => x.LastDelivery).HasColumnType("jsonb");
    }
}