using Application.Bases.Exceptions;
using Domain.Policies;
using Domain.Projects;
using Domain.Resources;

namespace Application.Projects;

public static class ProjectCreatorAccess
{
    private const string PolicyKeyPrefix = "project-creator-access-";
    private const string PolicyNamePrefix = "Creator access: ";
    private const int PolicyNameMaxLength = 128;

    public static string PolicyKey(Guid projectId) => $"{PolicyKeyPrefix}{projectId:N}";

    public static PolicyStatement[] BuildGrantStatements(
        PolicyStatement[] currentPermissions,
        string projectKey,
        IReadOnlyCollection<string> environmentKeys)
    {
        currentPermissions ??= [];
        var statements = new List<PolicyStatement>();
        var projectRn = RN.ForProject(projectKey);

        if (!PolicyHelper.IsAllowed(currentPermissions, projectRn, Permissions.CanAccessProject))
        {
            statements.Add(Allow(
                ResourceTypes.Project,
                Permissions.CanAccessProject,
                projectRn
            ));
        }

        var environmentRns = environmentKeys
            .Select(environmentKey => RN.ForEnv(projectKey, environmentKey))
            .ToArray();
        if (environmentRns.Any(environmentRn =>
                !PolicyHelper.IsAllowed(currentPermissions, environmentRn, Permissions.CanAccessEnv)))
        {
            statements.Add(Allow(
                ResourceTypes.Env,
                Permissions.CanAccessEnv,
                $"{projectRn}:env/*"
            ));
        }

        var effectivePermissions = currentPermissions.Concat(statements).ToArray();
        var canAccessCreatedProject =
            PolicyHelper.IsAllowed(effectivePermissions, projectRn, Permissions.CanAccessProject) &&
            environmentRns.All(environmentRn =>
                PolicyHelper.IsAllowed(effectivePermissions, environmentRn, Permissions.CanAccessEnv));
        if (!canAccessCreatedProject)
        {
            // An explicit matching Deny remains authoritative and must not be bypassed.
            throw new ForbiddenException();
        }

        return statements.ToArray();
    }

    public static Policy CreatePolicy(
        Guid organizationId,
        ProjectWithEnvs project,
        ICollection<PolicyStatement> statements)
    {
        var availableNameLength = PolicyNameMaxLength - PolicyNamePrefix.Length;
        var projectName = project.Name.Length <= availableNameLength
            ? project.Name
            : project.Name[..availableNameLength];
        var policy = new Policy(
            organizationId,
            $"{PolicyNamePrefix}{projectName}",
            PolicyKey(project.Id),
            $"Automatically grants the creator access to project '{project.Name}' and its environments."
        );
        policy.UpdateStatements(statements);

        return policy;
    }

    private static PolicyStatement Allow(string resourceType, string action, string resource)
    {
        return new PolicyStatement
        {
            Id = Guid.NewGuid().ToString(),
            ResourceType = resourceType,
            Effect = EffectType.Allow,
            Actions = [action],
            Resources = [resource]
        };
    }
}
