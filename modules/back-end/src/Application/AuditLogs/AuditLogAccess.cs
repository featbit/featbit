using Application.AccessTokens;
using Application.Bases.Exceptions;
using Application.Services;
using Application.Users;
using Domain.AccessTokens;

namespace Application.AuditLogs;

public class AuditLogAccess(IOrganizationService organizations, IUserService users, ICurrentUser user,
    ICurrentAccessToken currentAccessToken) : IAuditLogAccess
{
    public async Task EnsureAsync(Guid workspaceId, Guid orgId)
    {
        var token = currentAccessToken.Token;
        if (token != null && token.OrganizationId != orgId) throw new ForbiddenException();

        var organization = await organizations.FindOneAsync(x => x.Id == orgId && x.WorkspaceId == workspaceId);
        if (organization == null) throw new ForbiddenException();

        if (token?.Type != AccessTokenTypes.Service)
        {
            var userId = token?.CreatorId ?? user.Id;
            var workspaces = await users.GetWorkspacesAsync(userId);
            if (!workspaces.Any(x => x.Id == workspaceId)) throw new ForbiddenException();
            if (!await organizations.ContainsUserAsync(orgId, userId)) throw new ForbiddenException();
        }
    }
}
