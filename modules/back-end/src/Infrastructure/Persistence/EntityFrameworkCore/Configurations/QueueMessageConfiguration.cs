using Domain.Messages;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class QueueMessageConfiguration : IEntityTypeConfiguration<QueueMessage>
{
    public void Configure(EntityTypeBuilder<QueueMessage> builder)
    {
        builder.ToTable("queue_messages");

        builder.HasIndex(x => new { x.NotVisibleUntil, x.Topic, x.Status });

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).UseIdentityAlwaysColumn();

        builder.Property(x => x.Topic).HasMaxLength(128).IsRequired();
        builder.Property(x => x.Status).IsRequired().HasMaxLength(64).HasDefaultValue(QueueMessageStatus.Pending);
        builder.Property(x => x.EnqueuedAt).IsRequired().HasDefaultValueSql("now()");
        builder.Property(x => x.DeliverCount).IsRequired().HasDefaultValue(0);
    }
}