using Api.Authorization;
using Domain.Policies;

namespace Api.UnitTests.Authorization;

public class PermissionRequirementTests
{
    [Fact]
    public void Ctor_DefinedPermission_StoresName()
    {
        var req = new PermissionRequirement(Permissions.CreateFlag);

        Assert.Equal(Permissions.CreateFlag, req.PermissionName);
    }

    [Fact]
    public void Ctor_UnknownPermission_Throws()
    {
        Assert.Throws<ArgumentException>(() => new PermissionRequirement("DefinitelyNotAPermission"));
    }

    [Fact]
    public void ToString_IncludesPermissionName()
    {
        var req = new PermissionRequirement(Permissions.CreateFlag);

        Assert.Contains(Permissions.CreateFlag, req.ToString());
    }
}
