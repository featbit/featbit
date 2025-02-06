
using Domain.EndUsers;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EFCore.Configurations;

public class GlobalUserConfiguration : IEntityTypeConfiguration<GlobalUser>
{
    
    public void Configure(EntityTypeBuilder<GlobalUser> builder)
    {
        // Insert and update Global is a high volume request
        // Set WrokspaceId and EnvId as foreign key will cause performance issue
        // So we don't suggest to add foreign key here
        //
        //builder.HasOne(typeof(GlobalUser))
        //    .WithMany()
        //    .HasForeignKey(nameof(GlobalUser.WorkspaceId));
        //builder.HasOne(typeof(GlobalUser))
        //    .WithMany()
        //    .HasForeignKey(nameof(GlobalUser.));

        // Add WorkspaceId and EnvId index will improve the performance of query in an environment
        builder.HasIndex(x => x.WorkspaceId);
        builder.HasIndex(x => x.EnvId);

        builder.Property(x => x.CustomizedProperties).HasColumnType("jsonb");
    }
}