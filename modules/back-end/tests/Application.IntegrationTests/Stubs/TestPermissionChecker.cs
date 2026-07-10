using Api.Authorization;
using Microsoft.AspNetCore.Http;

namespace Application.IntegrationTests.Stubs;

/// <summary>
/// Test-only <see cref="IPermissionChecker"/> that returns <see cref="Grant"/> without
/// hitting the database. Production <see cref="DefaultPermissionChecker"/> calls
/// <c>IResourceService.GetEnvRnAsync</c>/<c>GetFlagRnAsync</c> etc. which open EF Core
/// connections to Postgres; in CI there is no Postgres, so unauthenticated requests to
/// <c>[Authorize(Permissions.X)]</c> routes would otherwise time out on EF retries.
/// Per-test consumers can toggle <see cref="Grant"/> before each test to drive policy outcome.
/// </summary>
public class TestPermissionChecker : IPermissionChecker
{
    public bool Grant { get; set; } = true;

    public List<PermissionRequirement> Calls { get; } = new();

    public Task<bool> IsGrantedAsync(HttpContext httpContext, PermissionRequirement requirement)
    {
        Calls.Add(requirement);
        return Task.FromResult(Grant);
    }
}
