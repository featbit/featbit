using Application.Users;
using Domain.Policies;
using Domain.Projects;
using Domain.Resources;

namespace Application.Projects;

public class GetProjectList : IRequest<IEnumerable<ProjectWithEnvs>>
{
    /// <summary>
    /// The ID of the organization the projects belong to. Retrieved from the request header.
    /// </summary>
    public Guid OrganizationId { get; set; }
}

public class GetProjectListHandler(
    IProjectService projectService,
    IMemberService memberService,
    ICurrentUser currentUser)
    : IRequestHandler<GetProjectList, IEnumerable<ProjectWithEnvs>>
{
    public async Task<IEnumerable<ProjectWithEnvs>> Handle(GetProjectList request, CancellationToken cancellationToken)
    {
        var projectWithEnvs = await projectService.GetListAsync(request.OrganizationId);
        var statements = 
            await memberService.GetPermissionsAsync(request.OrganizationId, currentUser.Id);

        // filter projects/envs based on permissions
        var allowedProjectEnvs =
            from project in projectWithEnvs
            let projectRN = RN.ForProject(project.Key)
            let canAccessProject = PolicyHelper.IsAllowed(statements, projectRN, Permissions.CanAccessProject)
            where canAccessProject
            let allowedEnvs =
                from env in project.Environments
                let envRN = RN.ForEnv(project.Key, env.Key)
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