using Application.Bases.Exceptions;
using Domain.Policies;
using Domain.Resources;
using Domain.Segments;

namespace Application.Segments;

public class SegmentCreationScopeGuard(
    IOrganizationService organizations,
    IProjectService projects,
    IEnvironmentService environments,
    IOrganizationPermissions organizationPermissions)
{
    public async Task EnsureAllowedAsync(CreateSegment request)
    {
        var scopes = request.Scopes.Distinct();
        foreach (var scope in scopes)
        {
            await EnsureScopeAllowedAsync(scope);
        }

        return;

        async Task EnsureScopeAllowedAsync(string scope)
        {
            var (scopeOrgId, scopeEnvId, projectEnvRn) =
                await ResolveScopeAsync(request.WorkspaceId, scope);

            if (request.Type == SegmentType.EnvironmentSpecific)
            {
                // For environment-specific segments, ensure the scope matches the current environment and organization.
                if (scopeEnvId != request.EnvId || scopeOrgId != request.OrgId)
                {
                    throw new ForbiddenException();
                }
            }

            if (request.Type == SegmentType.Shared)
            {
                // For shared segments, ensure the user has the necessary permissions for the resolved scope.
                var policies = await organizationPermissions.GetAsync(scopeOrgId);

                var canAccessEnv = SegmentScope.IsScopeAllowed(policies, projectEnvRn, Permissions.CanAccessEnv);
                var canCreateSegment = SegmentScope.IsScopeAllowed(
                    policies, $"{projectEnvRn}:segment/{request.Key}", Permissions.CreateSegment);

                if (!canAccessEnv || !canCreateSegment)
                {
                    throw new ForbiddenException();
                }
            }
        }
    }

    private async Task<ResolvedScope> ResolveScopeAsync(Guid workspaceId, string scope)
    {
        if (!RN.TryParse(scope, out var parsed))
        {
            throw new ForbiddenException();
        }

        var parts = parsed.ToArray();

        var organization = await organizations.FindOneAsync(x => x.WorkspaceId == workspaceId && x.Key == parts[0].Key)
            ?? throw new ForbiddenException();
        if (parts.Length == 1)
        {
            return new ResolvedScope(organization.Id, null, "project/*:env/*");
        }

        var project = await projects.FindOneAsync(x => x.OrganizationId == organization.Id && x.Key == parts[1].Key)
            ?? throw new ForbiddenException();
        if (parts.Length == 2)
        {
            return new ResolvedScope(organization.Id, null, $"project/{project.Key}:env/*");
        }

        var environment = await environments.FindOneAsync(x => x.ProjectId == project.Id && x.Key == parts[2].Key)
            ?? throw new ForbiddenException();
        return new ResolvedScope(organization.Id, environment.Id, $"project/{project.Key}:env/{environment.Key}");
    }

    private sealed record ResolvedScope(Guid OrganizationId, Guid? EnvId, string ProjectEnvRn);
}
