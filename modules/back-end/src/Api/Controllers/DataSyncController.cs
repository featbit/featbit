using System.Text.Json;
using Application.Bases;
using Application.Bases.Exceptions;
using Application.DataSync;
using Domain.DataSync;
using Domain.Utils;

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

    [HttpPost("upload")]
    // request size limit: 510MB
    [RequestSizeLimit(510 * 1024 * 1024)]
    // single file max size: 500MB 
    [RequestFormLimits(ValueLengthLimit = 500 * 1024 * 1024)]
    public async Task<ApiResponse<bool>> UploadAsync(Guid envId, IFormFile? file)
    {
        if (file is not { Length: > 0 })
        {
            return Ok(true);
        }

        SyncData? data;
        try
        {
            using var reader = new StreamReader(file.OpenReadStream());
            var content = await reader.ReadToEndAsync();
            data = JsonSerializer.Deserialize<SyncData>(content, ReusableJsonSerializerOptions.Web);
        }
        catch (JsonException)
        {
            throw new BusinessException(ErrorCodes.InvalidJson);
        }

        var request = new UploadSyncData
        {
            EnvId = envId,
            Data = data
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }
}