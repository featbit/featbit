using Application.Triggers;
using Domain.Triggers;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/triggers")]
public class TriggerController : ApiControllerBase
{
    [HttpGet]
    public async Task<ApiResponse<IEnumerable<Trigger>>> GetListAsync(Guid targetId)
    {
        var request = new GetTriggerList
        {
            TargetId = targetId
        };

        var triggers = await Mediator.Send(request);
        return Ok(triggers);
    }

    [HttpPost]
    public async Task<ApiResponse<Trigger>> CreateAsync(CreateTrigger request)
    {
        var trigger = await Mediator.Send(request);

        return Ok(trigger);
    }

    [HttpPut("{id:guid}")]
    public async Task<ApiResponse<bool>> UpdateAsync(Guid id, UpdateTrigger request)
    {
        request.Id = id;

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [HttpPut("{id:guid}/reset-token")]
    public async Task<ApiResponse<string>> ResetTokenAsync(Guid id)
    {
        var request = new ResetTriggerToken
        {
            Id = id
        };

        var newToken = await Mediator.Send(request);
        return Ok(newToken);
    }

    [HttpDelete("{id:guid}")]
    public async Task<ApiResponse<bool>> DeleteAsync(Guid id)
    {
        var request = new DeleteTrigger
        {
            Id = id
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [AllowAnonymous]
    [HttpPost("run/{token}")]
    public async Task<ApiResponse<bool>> RunTriggerAsync(string token)
    {
        var request = new RunTrigger
        {
            Token = token
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }
}