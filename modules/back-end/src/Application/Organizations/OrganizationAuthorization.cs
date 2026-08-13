using Application.Bases.Exceptions;
using Domain.Policies;
using Domain.Resources;

namespace Application.Organizations;

internal static class OrganizationAuthorization
{
    public static void EnsureAllowed(PolicyStatement[] currentUserPermissions, string permission)
    {
        if (!PolicyHelper.IsAllowed(currentUserPermissions, RN.ForOrganization(), permission))
        {
            throw new ForbiddenException();
        }
    }
}
