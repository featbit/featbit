using Application.Projects;
using Domain.Projects;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/projects")]
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
    public async Task<ApiResponse<IEnumerable<ProjectWithEnvs>>> GetListAsync()
    {
        var request = new GetProjectList
        {
            OrganizationId = OrgId
        };

        var projects = await Mediator.Send(request);
        return Ok(projects);
    }

    [HttpPost]
    public async Task<ApiResponse<ProjectWithEnvs>> CreateAsync(CreateProject request)
    {
        request.OrganizationId = OrgId;

        var projectWithEnvs = await Mediator.Send(request);
        return Ok(projectWithEnvs);
    }

    [HttpPut("{id:guid}")]
    public async Task<ApiResponse<ProjectVm>> UpdateAsync(Guid id, UpdateProject request)
    {
        request.Id = id;

        var project = await Mediator.Send(request);
        return Ok(project);
    }

    [HttpDelete]
    [Route("{id:guid}")]
    public async Task<ApiResponse<bool>> DeleteAsync(Guid id)
    {
        var request = new DeleteProject
        {
            Id = id
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [HttpGet("is-key-used")]
    public async Task<ApiResponse<bool>> IsKeyUsedAsync(string key)
    {
        var request = new IsKeyUsed
        {
            OrganizationId = OrgId,
            Key = key
        };

        var isUsed = await Mediator.Send(request);
        return Ok(isUsed);
    }
}