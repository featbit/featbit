using Domain.EndUsers;
using Domain.Workspaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EFCore.Configurations;

public class EndUserConfiguration : IEntityTypeConfiguration<EndUser>
{
    
    public void Configure(EntityTypeBuilder<EndUser> builder)
    {
        // Insert and update EndUser is a high volume request
        // Set WrokspaceId and EnvId as foreign key will cause performance issue
        // So we don't suggest to add foreign key here
        //
        //builder.HasOne(typeof(EndUser))
        //    .WithMany()
        //    .HasForeignKey(nameof(EndUser.WorkspaceId));
        //builder.HasOne(typeof(EndUser))
        //    .WithMany()
        //    .HasForeignKey(nameof(EndUser.EnvId));

        // Add EnvId index will improve the performance of query in an environment
        builder.HasIndex(x => x.EnvId);

        builder.Property(x => x.CustomizedProperties).HasColumnType("jsonb");
    }
}