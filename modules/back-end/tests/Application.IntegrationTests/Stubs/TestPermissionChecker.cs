using Api.Authorization;
using Microsoft.AspNetCore.Http;

namespace Application.IntegrationTests.Stubs;

public class TestPermissionChecker : IPermissionChecker
{
    public Task<bool> IsGrantedAsync(HttpContext httpContext, PermissionRequirement requirement)
    {
        return Task.FromResult(true);
    }
}
