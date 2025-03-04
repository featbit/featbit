using Domain.FlagSchedules;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class FlagScheduleConfiguration : IEntityTypeConfiguration<FlagSchedule>
{
    public void Configure(EntityTypeBuilder<FlagSchedule> builder)
    {
        builder.ToTable("flag_schedules");

        builder.HasIndex(x => x.FlagId);

        builder.Property(x => x.Status).HasMaxLength(64).IsRequired();
        builder.Property(x => x.Title).HasMaxLength(128).IsRequired();
        builder.Property(x => x.ScheduledTime).IsRequired();
    }
}