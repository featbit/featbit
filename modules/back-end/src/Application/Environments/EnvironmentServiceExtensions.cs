using Application.Bases.Exceptions;
using Domain.Environments;

namespace Application.Environments;

internal static class EnvironmentServiceExtensions
{
    public static async Task<ResourceDescriptor> GetResourceDescriptorInOrganizationAsync(
        this IEnvironmentService environments, Guid orgId, Guid envId)
    {
        var environment = await environments.GetResourceDescriptorAsync(envId);
        if (environment == null || environment.Organization.Id != orgId)
        {
            throw new ForbiddenException();
        }

        return environment;
    }
}
