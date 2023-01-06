using Application.Environments;
using Domain.Environments;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/envs/{envId:guid}/secrets")]
public class EnvironmentSecretController : ApiControllerBase
{
    [HttpPost]
    public async Task<ApiResponse<Secret>> CreateAsync(Guid envId, AddSecret request)
    {
        request.EnvId = envId;

        var added = await Mediator.Send(request);
        return Ok(added);
    }

    [HttpPut("{id}")]
    public async Task<ApiResponse<bool>> UpdateAsync(Guid envId, string id, UpdateSecret request)
    {
        request.EnvId = envId;
        request.SecretId = id;

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [HttpDelete("{id}")]
    public async Task<ApiResponse<bool>> DeleteAsync(Guid envId, string id)
    {
        var request = new DeleteSecret
        {
            EnvId = envId,
            SecretId = id
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }
}