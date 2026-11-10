using Application.Bases.Exceptions;
using Domain.Policies;
using Domain.Resources;
using Domain.Segments;

namespace Application.Segments;

public class SegmentScopeGuard(
    IOrganizationService organizations,
    IProjectService projects,
    IEnvironmentService environments,
    IOrganizationPermissions permissions)
{
    public async Task EnsureAllowedAsync(CreateSegment request)
    {
        foreach (var scope in request.Scopes.Distinct())
        {
            // The validator checks the shape; resolve every level in its parent scope.
            RN.TryParse(scope, out var parsed);
            var parts = parsed.ToArray();
            var org = await organizations.FindOneAsync(x => x.WorkspaceId == request.WorkspaceId && x.Key == parts[0].Key);
            if (org == null) throw new ForbiddenException();
            var relativeRn = "project/*:env/*";
            Guid? scopeEnvId = null;
            if (parts.Length > 1)
            {
                var project = await projects.FindOneAsync(x => x.OrganizationId == org.Id && x.Key == parts[1].Key);
                if (project == null) throw new ForbiddenException();
                relativeRn = $"project/{project.Key}:env/*";
                if (parts.Length > 2)
                {
                    var env = await environments.FindOneAsync(x => x.ProjectId == project.Id && x.Key == parts[2].Key);
                    if (env == null) throw new ForbiddenException();
                    scopeEnvId = env.Id;
                    relativeRn = $"project/{project.Key}:env/{env.Key}";
                }
            }
            if (request.Type == SegmentType.EnvironmentSpecific &&
                (request.Scopes.Length != 1 || scopeEnvId != request.EnvId || org.Id != request.OrgId))
                throw new ForbiddenException();
            var policies = await permissions.GetAsync(org.Id);
            if (!IsScopeAllowed(policies, relativeRn, Permissions.CanAccessEnv) ||
                !IsScopeAllowed(policies, $"{relativeRn}:segment/{request.Key}", Permissions.CreateSegment))
                throw new ForbiddenException();
        }
    }

    // A broad sharing scope must not bypass a deny on one of its narrower environments.
    private static bool IsScopeAllowed(PolicyStatement[] policies, string rn, string action) =>
        PolicyHelper.IsAllowed(policies, rn, action) && !policies.Any(policy =>
            policy.Effect == EffectType.Deny &&
            policy.Actions.Any(a => a == "*" || a == action) &&
            policy.Resources.Any(pattern => IntersectsScope(rn, pattern)));

    private static bool IntersectsScope(string rn, string denyPattern)
    {
        var scopeParts = rn.Split(':');
        var denyParts = denyPattern.Split(':');
        if (denyParts.Length > scopeParts.Length) return false;
        return denyParts.Select((part, index) =>
            RNMatcher.IsMatch(scopeParts[index], part) || RNMatcher.IsMatch(part, scopeParts[index])).All(match => match);
    }

    public static bool IsValidScope(string scope)
    {
        if (!RN.TryParse(scope, out var parsed)) return false;
        var parts = parsed.ToArray();
        string[] types = [ResourceTypes.Organization, ResourceTypes.Project, ResourceTypes.Env];
        return parts.Length is >= 1 and <= 3 && parts.Select((part, index) =>
            part.Type == types[index] && !string.IsNullOrWhiteSpace(part.Key) &&
            !part.Key.Any(c => c is '*' or ';' or '/' || char.IsWhiteSpace(c))).All(valid => valid);
    }
}
