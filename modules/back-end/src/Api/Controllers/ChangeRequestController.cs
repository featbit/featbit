using Api.Authentication;
using Application.ChangeRequests;
using Application.FeatureFlags;
using Domain.Policies;
using Domain.Workspaces;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/envs/{envId:guid}/change-requests")]
public class ChangeRequestController : ApiControllerBase
{
    /// <summary>
    /// Get the change requests for an environment.
    /// </summary>
    [HttpGet]
    public async Task<ApiResponse<ChangeRequestListVm>> GetListAsync(
        Guid envId,
        [FromQuery] ChangeRequestFilter filter)
    {
        var request = new GetChangeRequestList
        {
            OrgId = OrgId,
            EnvId = envId,
            Filter = filter
        };

        var changeRequests = await Mediator.Send(request);
        return Ok(changeRequests);
    }

    /// <summary>
    /// Create a change request for a feature flag.
    /// </summary>
    [HttpPost("{key}")]
    [Authorize(LicenseFeatures.ChangeRequest)]
    public async Task<ApiResponse<bool>> CreateAsync(
        Guid envId,
        string key,
        CreateFlagChangeRequest request)
    {
        request.OrgId = OrgId;
        request.Key = key;
        request.EnvId = envId;

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    /// <summary>
    /// Approve a change request assigned to the current user.
    /// </summary>
    [HttpPut("{id:guid}/approve")]
    [Authorize(LicenseFeatures.ChangeRequest)]
    public async Task<ApiResponse<bool>> ApproveAsync(Guid envId, Guid id)
    {
        var request = new ApproveFlagChangeRequest
        {
            OrgId = OrgId,
            EnvId = envId,
            Id = id
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    /// <summary>
    /// Decline a change request assigned to the current user.
    /// </summary>
    [HttpPut("{id:guid}/decline")]
    [Authorize(LicenseFeatures.ChangeRequest)]
    public async Task<ApiResponse<bool>> DeclineAsync(Guid envId, Guid id)
    {
        var request = new DeclineFlagChangeRequest
        {
            OrgId = OrgId,
            EnvId = envId,
            Id = id
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    /// <summary>
    /// Apply an approved change request when the current user is a reviewer or creator.
    /// </summary>
    [HttpPut("{id:guid}/apply")]
    [Authorize(LicenseFeatures.ChangeRequest)]
    public async Task<ApiResponse<bool>> ApplyAsync(Guid envId, Guid id)
    {
        var request = new ApplyFlagChangeRequest
        {
            OrgId = OrgId,
            EnvId = envId,
            Id = id
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    /// <summary>
    /// Delete a change request.
    /// </summary>
    [HttpDelete("{id:guid}")]
    [Authorize(LicenseFeatures.ChangeRequest)]
    public async Task<ApiResponse<bool>> DeleteAsync(Guid id)
    {
        var request = new DeleteFlagChangeRequest
        {
            Id = id
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }
}
