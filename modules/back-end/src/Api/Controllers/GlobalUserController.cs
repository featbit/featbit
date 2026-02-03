using System.Text.Json;
using Application.Bases;
using Application.Bases.Exceptions;
using Application.Bases.Models;
using Application.GlobalUsers;
using Domain.EndUsers;
using Domain.Utils;
using Domain.Workspaces;

namespace Api.Controllers;

[Authorize(LicenseFeatures.GlobalUser)]
[Route("api/v{version:apiVersion}/global-users")]
public class GlobalUserController : ApiControllerBase
{
    [HttpGet]
    public async Task<ApiResponse<PagedResult<GlobalUser>>> GetListAsync([FromQuery] GlobalUserFilter filter)
    {
        var request = new GetGlobalUserList
        {
            WorkspaceId = WorkspaceId,
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
    public async Task<ApiResponse<bool>> UploadAsync(IFormFile? file)
    {
        if (file is not { Length: > 0 })
        {
            return Ok(true);
        }

        ImportGlobalUser? request;
        try
        {
            using var jsonDocument = await JsonDocument.ParseAsync(file.OpenReadStream());
            var users = jsonDocument.RootElement
                .GetProperty("users")
                .Deserialize<ImportUser[]>(ReusableJsonSerializerOptions.Web);
            request = new ImportGlobalUser(WorkspaceId, users);
        }
        catch (JsonException)
        {
            throw new BusinessException(ErrorCodes.Invalid("file"));
        }

        var success = await Mediator.Send(request);
        return Ok(success);
    }
}