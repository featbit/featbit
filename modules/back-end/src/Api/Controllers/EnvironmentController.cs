using Application.Environments;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/projects/{projectId:guid}/envs")]
public class EnvironmentController : ApiControllerBase
{
    [HttpPost]
    public async Task<ApiResponse<EnvironmentVm>> CreateAsync(Guid projectId, CreateEnvironment request)
    {
        request.ProjectId = projectId;

        var env = await Mediator.Send(request);
        return Ok(env);
    }

    [HttpPut("{id:guid}")]
    public async Task<ApiResponse<EnvironmentVm>> UpdateAsync(Guid id, UpdateEnvironment request)
    {
        request.Id = id;

        var env = await Mediator.Send(request);
        return Ok(env);
    }

    [HttpDelete("{id:guid}")]
    public async Task<ApiResponse<bool>> DeleteAsync(Guid id)
    {
        var request = new DeleteEnvironment
        {
            Id = id
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }
}