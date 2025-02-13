using Domain.FlagSchedules;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class FlagScheduleConfiguration : IEntityTypeConfiguration<FlagSchedule>
{   
    public void Configure(EntityTypeBuilder<FlagSchedule> builder)
    {
        builder.HasIndex(x => x.OrgId);
        builder.HasIndex(x => x.EnvId);

        builder.Property(x => x.Status)
            .HasMaxLength(255)
            .IsRequired();
        builder.Property(x => x.Title)
            .HasMaxLength(255)
            .IsRequired();
        builder.Property(x => x.ScheduledTime)
            .IsRequired();
    }
}