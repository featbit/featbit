using System.Text.Json;
using Application.Bases;
using Application.Bases.Exceptions;
using Application.Bases.Models;
using Application.EndUsers;
using Application.FeatureFlags;
using Domain.EndUsers;
using Domain.Utils;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/envs/{envId:guid}/end-users")]
public class EndUserController : ApiControllerBase
{
    [HttpGet("{id:guid}")]
    public async Task<ApiResponse<EndUser>> GetAsync(Guid id)
    {
        var request = new GetEndUser
        {
            Id = id
        };

        var user = await Mediator.Send(request);
        return Ok(user);
    }

    [HttpPost]
    public async Task<ApiResponse<PagedResult<EndUser>>> GetListAsync(Guid envId, SearchEndUser query)
    {
        var filter = new EndUserFilter(query);

        var request = new GetEndUserList
        {
            WorkspaceId = WorkspaceId,
            EnvId = envId,
            Filter = filter
        };

        var users = await Mediator.Send(request);
        return Ok(users);
    }

    [HttpPut]
    public async Task<ApiResponse<EndUser>> UpsertAsync(Guid envId, UpsertEndUser request)
    {
        request.EnvId = envId;

        var user = await Mediator.Send(request);
        return Ok(user);
    }

    [HttpPost("by-keyIds")]
    public async Task<ApiResponse<IEnumerable<EndUser>>> GetByKeyIdsAsync(Guid envId, [FromBody] string[] keyIds)
    {
        var request = new GetEndUserByKeyIds
        {
            EnvId = envId,
            KeyIds = keyIds
        };

        var users = await Mediator.Send(request);
        return Ok(users);
    }

    [HttpGet("{id:guid}/flags")]
    public async Task<ApiResponse<PagedResult<EndUserFlagVm>>> GetFlagsAsync(
        Guid envId,
        Guid id, 
        [FromQuery] FeatureFlagFilter filter)
    {
        var request = new GetEndUserFlags
        {
            EnvId = envId,
            Id = id,
            Filter = filter
        };

        var flags = await Mediator.Send(request);
        return Ok(flags);
    }

    [HttpGet("{id:guid}/segments")]
    public async Task<ApiResponse<IEnumerable<EndUserSegmentVm>>> GetSegmentsAsync(Guid envId, Guid id)
    {
        var request = new GetEndUserSegments
        {
            WorkspaceId = WorkspaceId,
            EnvId = envId,
            Id = id
        };

        var segments = await Mediator.Send(request);
        return Ok(segments);
    }

    [HttpGet("get-by-featureflag")]
    public async Task<ApiResponse<PagedResult<FeatureFlagEndUserStatsVm>>> GetListByFeatureFlagAsync(Guid envId, [FromQuery] FeatureFlagEndUserFilter filter)
    {
        var request = new GetFeatureFlagEndUserList
        {
            EnvId = envId,
            Filter = filter
        };

        var users = await Mediator.Send(request);
        return Ok(users);
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

        ImportEndUser? request;
        try
        {
            using var jsonDocument = await JsonDocument.ParseAsync(file.OpenReadStream());
            var data = jsonDocument.RootElement.Deserialize<ImportUserData>(ReusableJsonSerializerOptions.Web);
            request = new ImportEndUser(envId, data);
        }
        catch (JsonException)
        {
            throw new BusinessException(ErrorCodes.Invalid("file"));
        }

        var success = await Mediator.Send(request);
        return Ok(success);
    }
}