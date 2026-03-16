using Application.Bases.Exceptions;
using Application.Users;
using Domain.Policies;
using Domain.Projects;
using Domain.Resources;

namespace Application.Projects;

public class GetProject : IRequest<ProjectWithEnvs>
{
    public Guid OrganizationId { get; set; }

    public Guid Id { get; set; }
}

public class GetProjectHandler(
    IProjectService projectService,
    IMemberService memberService,
    ICurrentUser currentUser)
    : IRequestHandler<GetProject, ProjectWithEnvs>
{
    public async Task<ProjectWithEnvs> Handle(GetProject request, CancellationToken cancellationToken)
    {
        var project = await projectService.GetWithEnvsAsync(request.Id);
        var statements =
            await memberService.GetPermissionsAsync(request.OrganizationId, currentUser.Id);

        // filter projects/envs based on permissions
        var projectRN = RN.ForProject(project.Key);
        var canAccessProject = PolicyHelper.IsAllowed(statements, projectRN, Permissions.CanAccessProject);
        if (!canAccessProject)
        {
            throw new ForbiddenException();
        }

        var accessibleEnvs =
            from env in project.Environments
            let envRN = RN.ForEnv(project.Key, env.Key)
            let canAccessEnv = PolicyHelper.IsAllowed(statements, envRN, Permissions.CanAccessEnv)
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