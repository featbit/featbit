using Application.Bases.Exceptions;
using Application.Environments;
using Domain.AccessTokens;
using Domain.Environments;
using Microsoft.AspNetCore.Http;

namespace Application.ReleaseMetricSourceConnections;

public class ReleaseMetricSourceConnectionAccessGuard(
    IEnvironmentService environmentService,
    IOrganizationService organizationService,
    IHttpContextAccessor httpContextAccessor)
{
    public async Task<ResourceDescriptor> GetEnvironmentAsync(Guid orgId, Guid envId)
    {
        var environment = await environmentService.GetResourceDescriptorInOrganizationAsync(orgId, envId);

        // A personal access token acts for its creator in this organization.
        var accessToken = httpContextAccessor.HttpContext?.Items[ApplicationConsts.AccessTokenItem];
        if (accessToken is AccessToken { Type: AccessTokenTypes.Personal } token &&
            !await organizationService.ContainsUserAsync(orgId, token.CreatorId))
        {
            throw new ForbiddenException();
        }

        return environment;
    }
}
