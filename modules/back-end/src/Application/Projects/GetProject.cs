using Application.Bases.Exceptions;
using Domain.Policies;
using Domain.Projects;
using Domain.Resources;

namespace Application.Projects;

public class GetProject : IRequest<ProjectWithEnvs>
{
    /// <summary>
    /// The ID of the project to retrieve. Retrieved from the route parameter.
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Current request permissions
    /// </summary>
    public PolicyStatement[] Permissions { get; set; }
}

public class GetProjectHandler(IProjectService projectService)
    : IRequestHandler<GetProject, ProjectWithEnvs>
{
    public async Task<ProjectWithEnvs> Handle(GetProject request, CancellationToken cancellationToken)
    {
        var project = await projectService.GetWithEnvsAsync(request.Id);
        var permissions = request.Permissions;

        // filter projects/envs based on permissions
        var projectRN = RN.ForProject(project.Key);
        var canAccessProject = PolicyHelper.IsAllowed(permissions, projectRN, Permissions.CanAccessProject);
        if (!canAccessProject)
        {
            throw new ForbiddenException();
        }

        var accessibleEnvs =
            from env in project.Environments
            let envRN = RN.ForEnv(project.Key, env.Key)
            let canAccessEnv = PolicyHelper.IsAllowed(permissions, envRN, Permissions.CanAccessEnv)
            where canAccessEnv
            select env;

        return new ProjectWithEnvs
        {
            Id = project.Id,
            Key = project.Key,
            Name = project.Name,
            Environments = accessibleEnvs
        };
    }
}