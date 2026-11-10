using Api.Authentication;
using Application.Services;
using Domain.Policies;
using Domain.Users;

namespace Api.Authorization;

public class OrganizationPermissions(
    IHttpContextAccessor accessor,
    IRequestPermissions requestPermissions,
    IOrganizationService organizations,
    IMemberService members) : IOrganizationPermissions
{
    private readonly Dictionary<Guid, PolicyStatement[]> _permissions = new();

    public async Task<PolicyStatement[]> GetAsync(Guid organizationId)
    {
        var context = accessor.HttpContext;
        if (context == null || organizationId == Guid.Empty) return [];
        if (organizationId == context.Request.OrganizationId()) return await requestPermissions.GetAsync(context);
        // API tokens are bound to a single organization, including personal tokens.
        if (context.User.Identity?.AuthenticationType != Schemes.JwtBearer) return [];
        if (_permissions.TryGetValue(organizationId, out var cached)) return cached;
        var userClaim = context.User.FindFirst(UserClaims.Id)?.Value;
        if (!Guid.TryParse(userClaim, out var userId)) return [];
        var organization = await organizations.FindOneAsync(x =>
            x.Id == organizationId && x.WorkspaceId == context.Request.WorkspaceId());
        if (organization == null || !await organizations.ContainsUserAsync(organizationId, userId)) return [];
        var policies = await members.GetPermissionsAsync(organizationId, userId);
        _permissions.Add(organizationId, policies);
        return policies;
    }
}
