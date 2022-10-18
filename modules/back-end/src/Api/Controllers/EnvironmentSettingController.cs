using Application.Environments;
using Domain.Environments;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/envs/{envId:guid}/settings")]
public class EnvironmentSettingController : ApiControllerBase
{
    [HttpGet]
    public async Task<ApiResponse<IEnumerable<Setting>>> GetByTypeAsync(Guid envId, string type)
    {
        var request = new GetSettings
        {
            EnvId = envId,
            Type = type
        };

        var settings = await Mediator.Send(request);
        return Ok(settings);
    }

    [HttpPut]
    public async Task<ApiResponse<bool>> UpsertAsync(Guid envId, UpsertSetting request)
    {
        request.EnvId = envId;

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [HttpDelete("{id}")]
    public async Task<ApiResponse<bool>> DeleteAsync(Guid envId, string id)
    {
        var request = new DeleteSetting
        {
            EnvId = envId,
            Id = id
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }
}