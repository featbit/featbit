using Application.DataSync;
using Domain.DataSync;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/envs/{envId:guid}/data-sync")]
public class DataSyncController : ApiControllerBase
{
    [HttpGet("download")]
    public async Task<ApiResponse<SyncData>> DownloadAsync(Guid envId)
    {
        var request = new DownloadSyncData
        {
            EnvId = envId
        };

        var data = await Mediator.Send(request);
        return Ok(data);
    }

    [HttpPut("to-remote")]
    public async Task<ApiResponse<string>> SyncToRemoteAsync(Guid envId, string settingId)
    {
        var request = new SyncToRemote
        {
            EnvId = envId,
            SettingId = settingId
        };

        var payload = await Mediator.Send(request);
        return Ok(payload);
    }
}