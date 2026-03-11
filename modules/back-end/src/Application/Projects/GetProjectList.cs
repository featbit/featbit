using Application.Users;
using Domain.Policies;
using Domain.Projects;

namespace Application.Projects;

public class GetProjectList : IRequest<IEnumerable<ProjectWithEnvs>>
{
    /// <summary>
    /// The ID of the organization the projects belong to. Retrieved from the request header.
    /// </summary>
    public Guid OrganizationId { get; set; }
}

public class GetProjectListHandler(IProjectService service, ICurrentUser currentUser)
    : IRequestHandler<GetProjectList, IEnumerable<ProjectWithEnvs>>
{
    public async Task<IEnumerable<ProjectWithEnvs>> Handle(GetProjectList request, CancellationToken cancellationToken)
    {
        var projectWithEnvs = await service.GetListAsync(request.OrganizationId);
        var statements = currentUser.Permissions;

        // filter projects/envs based on permissions
        var allowedProjectEnvs =
            from project in projectWithEnvs
            let projectRN = $"project/{project.Key}"
            let canAccessProject = PolicyHelper.IsAllowed(statements, projectRN, Permissions.CanAccessProject)
            where canAccessProject
            let allowedEnvs =
                from env in project.Environments
                let envRN = $"project/{project.Key}:env/{env.Key}"
                let canAccessEnv = PolicyHelper.IsAllowed(statements, envRN, Permissions.CanAccessEnv)
                where canAccessEnv
                select env
            where allowedEnvs.Any()
            select new ProjectWithEnvs
            {
                Id = project.Id,
                Key = project.Key,
                Name = project.Name,
                Environments = allowedEnvs
            };

        return allowedProjectEnvs;
    }
}