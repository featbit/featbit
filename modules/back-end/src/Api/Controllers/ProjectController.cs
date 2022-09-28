using Application.Projects;
using Domain.Projects;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/organizations/{organizationId:guid}/projects")]
public class ProjectController : ApiControllerBase
{
    [HttpGet]
    [Route("{projectId:guid}")]
    public async Task<ApiResponse<ProjectWithEnvs>> GetAsync(Guid projectId)
    {
        var request = new GetProject
        {
            Id = projectId
        };

        var project = await Mediator.Send(request);
        return Ok(project);
    }
    
    [HttpGet]
    public async Task<ApiResponse<IEnumerable<ProjectWithEnvs>>> GetListAsync(Guid organizationId)
    {
        var request = new GetProjectList
        {
            OrganizationId = organizationId
        };

        var projects = await Mediator.Send(request);
        return Ok(projects);
    }
}