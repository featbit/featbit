using System.Security.Claims;
using System.Collections.Concurrent;
using Api.Authentication;
using Application.Services;
using Domain.Users;
using Domain.Organizations;
using Infrastructure.Identity;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Api.Authorization;

/// <summary>
/// Authorizes the organization selection that follows a successful workspace OIDC login.
/// The frontend first-login flag and the user's account origin are not authorization evidence.
/// </summary>
public sealed class SsoOrganizationJoinAuthorization(
    IHttpContextAccessor accessor,
    JwtOptions jwt,
    IUserService users,
    IOrganizationService organizations) : ISsoOrganizationJoinAuthorization
{
    internal const string CookieName = "sso-organization-join";
    private const string CookiePath = "/api/v1";
    private const string WorkspaceClaim = "sso_workspace";
    private string Audience => $"{jwt.Audience}:sso-organization-join";

    // This service is scoped: results are shared by middleware and handlers only within one request.
    private readonly ConcurrentDictionary<(Guid User, Guid Workspace, Guid Organization), Lazy<Task<OrganizationJoinAuthorization>>> _joinResults = new();

    // Called only after a successful OIDC code exchange for this workspace.
    public void Issue(HttpContext context, Guid userId, Guid workspaceId)
    {
        var token = new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = jwt.Issuer,
            Audience = Audience,
            Expires = DateTime.UtcNow.AddMinutes(5),
            Subject = new ClaimsIdentity([
                new Claim(UserClaims.Id, userId.ToString()),
                new Claim(WorkspaceClaim, workspaceId.ToString())
            ]),
            SigningCredentials = new SigningCredentials(jwt.SigningSecurityKey, jwt.Algorithm)
        });
        context.Response.Cookies.Append(CookieName, token, new CookieOptions
        {
            HttpOnly = true,
            Secure = context.Request.IsHttps,
            SameSite = SameSiteMode.Lax,
            Path = CookiePath,
            MaxAge = TimeSpan.FromMinutes(5)
        });
    }

    public static void Clear(HttpResponse response) =>
        response.Cookies.Delete(CookieName, new CookieOptions { Path = CookiePath });

    public async Task<bool> CanChooseOrganizationAsync(Guid workspaceId, Guid userId,
        ICollection<Organization> joinedOrganizations)
    {
        if (joinedOrganizations.Count != 0) return false;

        if (!await HasValidTicketAsync(workspaceId, userId)) return false;

        var workspaces = await users.GetWorkspacesAsync(userId);
        return workspaces.Any(workspace => workspace.Id == workspaceId);
    }

    private async Task<bool> HasValidTicketAsync(Guid workspaceId, Guid userId)
    {
        var context = accessor.HttpContext;
        if (context?.User.Identity is not { IsAuthenticated: true, AuthenticationType: Schemes.JwtBearer } ||
            context.User.FindFirst(UserClaims.Id)?.Value != userId.ToString() ||
            !context.Request.Cookies.TryGetValue(CookieName, out var ticket))
        {
            return false;
        }

        var result = await new JsonWebTokenHandler().ValidateTokenAsync(ticket, new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwt.Issuer,
            ValidateAudience = true,
            ValidAudience = Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = jwt.VerificationSecurityKey,
            ValidAlgorithms = [jwt.Algorithm],
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero
        });
        if (!result.IsValid ||
            result.ClaimsIdentity.FindFirst(UserClaims.Id)?.Value != userId.ToString() ||
            result.ClaimsIdentity.FindFirst(WorkspaceClaim)?.Value != workspaceId.ToString())
        {
            return false;
        }

        return true;
    }

    public Task<OrganizationJoinAuthorization> GetJoinAuthorizationAsync(Guid workspaceId, Guid organizationId, Guid userId) =>
        _joinResults.GetOrAdd((userId, workspaceId, organizationId), key =>
            new(() => AuthorizeJoinAsync(key.Workspace, key.Organization, key.User))).Value;

    private async Task<OrganizationJoinAuthorization> AuthorizeJoinAsync(Guid workspaceId, Guid organizationId, Guid userId)
    {
        if (workspaceId == Guid.Empty || organizationId == Guid.Empty || userId == Guid.Empty ||
            !await organizations.AnyAsync(org => org.Id == organizationId && org.WorkspaceId == workspaceId))
        {
            return new(false, false);
        }

        var workspaces = await users.GetWorkspacesAsync(userId);
        if (!workspaces.Any(workspace => workspace.Id == workspaceId)) return new(false, false);

        // Retrying a completed join is harmless; it must not assign default permissions again.
        var orgs = await organizations.GetUserOrganizationsAsync(workspaceId, userId);
        if (orgs.Any(org => org.Id == organizationId)) return new(true, true);

        var allowed = orgs.Count == 0 && await HasValidTicketAsync(workspaceId, userId);
        return new(allowed, false);
    }
}
