using Application.Projects;
using Domain.Projects;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/organizations/{organizationId}/projects")]
public class ProjectController : ApiControllerBase
{
    [HttpGet]
    [Route("{projectId}")]
    public async Task<ApiResponse<ProjectWithEnvs>> GetAsync(string projectId)
    {
        var request = new GetProject
        {
            Id = projectId
        };

        var project = await Mediator.Send(request);
        return Ok(project);
    }
    
    [HttpGet]
    public async Task<ApiResponse<IEnumerable<ProjectWithEnvs>>> GetListAsync(string organizationId)
    {
        var request = new GetProjectList
        {
            OrganizationId = organizationId
        };

        var projects = await Mediator.Send(request);
        return Ok(projects);
    }
}