using Api.Controllers;
using Domain.Policies;
using Microsoft.AspNetCore.Authorization;

namespace Api.UnitTests.Controllers;

public class RelayProxyControllerAuthorizationTests
{
    public static TheoryData<string, string> ProtectedActions => new()
    {
        { nameof(RelayProxyController.GetListAsync), Permissions.ListRelayProxies },
        { nameof(RelayProxyController.CreateAsync), Permissions.ManageRelayProxies },
        { nameof(RelayProxyController.UpdateAsync), Permissions.ManageRelayProxies },
        { nameof(RelayProxyController.IsNameUsedAsync), Permissions.ManageRelayProxies },
        { nameof(RelayProxyController.DeleteAsync), Permissions.ManageRelayProxies },
        { nameof(RelayProxyController.CheckAgentAvailabilityAsync), Permissions.ManageRelayProxies },
        { nameof(RelayProxyController.SyncToAgentAsync), Permissions.ManageRelayProxies }
    };

    [Theory]
    [MemberData(nameof(ProtectedActions))]
    public void Action_RequiresExpectedPermission(string methodName, string permission)
    {
        var method = typeof(RelayProxyController).GetMethod(methodName);

        var policies = method!
            .GetCustomAttributes(typeof(AuthorizeAttribute), inherit: true)
            .Cast<AuthorizeAttribute>()
            .Select(attribute => attribute.Policy)
            .ToArray();

        Assert.Contains(permission, policies);
    }
}
