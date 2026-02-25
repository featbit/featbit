using Api.Authentication;
using Api.Authorization;
using Application.Workspaces;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/workspaces")]
public class WorkspaceController : ApiControllerBase
{
    /// <summary>
    /// Get a workspace
    /// </summary>
    /// <remarks>
    /// Get a workspace by id. ID is retrieved from the request header.
    /// </remarks>
    [OpenApi]
    [HttpGet]
    public async Task<ApiResponse<WorkspaceVm>> GetAsync()
    {
        var request = new GetWorkspace
        {
            Id = WorkspaceId,
        };

        var workspace = await Mediator.Send(request);
        return Ok(workspace);
    }

    /// <summary>
    /// Update workspace license
    /// </summary>
    /// <remarks>
    /// Apply a license key to the workspace to unlock premium features.
    /// </remarks>
    [OpenApi]
    [HttpPut("license")]
    [Authorize(Permissions.UpdateWorkspaceLicense)]
    public async Task<ApiResponse<WorkspaceVm>> UpdateLicenseAsync(UpdateLicense request)
    {
        request.Id = WorkspaceId;

        var workspace = await Mediator.Send(request);
        return Ok(workspace);
    }

    /// <summary>
    /// Get workspace usage statistics. ID is retrieved from the request header.
    /// </summary>
    /// <remarks>
    /// Retrieve usage metrics and statistics for the workspace, including resource consumption and limits.
    /// </remarks>
    [HttpGet("usages")]
    public async Task<ApiResponse<object>> GetUsagesAsync()
    {
        var request = new GetWorkspaceUsages
        {
            WorkspaceId = WorkspaceId,
        };

        var usage = await Mediator.Send(request);
        return Ok(usage);
    }

    /// <summary>
    /// Update workspace OIDC SSO configuration
    /// </summary>
    /// <remarks>
    /// Configure OpenID Connect (OIDC) single sign-on settings for the workspace.
    /// </remarks>
    [OpenApi]
    [HttpPut("sso-oidc")]
    [Authorize(Permissions.UpdateWorkspaceSSOSettings)]
    public async Task<ApiResponse<WorkspaceVm>> UpdateOidcAsync(UpdateOidc request)
    {
        request.Id = WorkspaceId;

        var workspace = await Mediator.Send(request);
        return Ok(workspace);
    }

    [HttpGet("is-key-used")]
    public async Task<ApiResponse<bool>> IsKeyUsedAsync(string key)
    {
        var request = new IsKeyUsed
        {
            WorkspaceId = WorkspaceId,
            Key = key
        };

        var isUsed = await Mediator.Send(request);
        return Ok(isUsed);
    }

    /// <summary>
    /// Update workspace
    /// </summary>
    /// <remarks>
    /// Update the name and key of the workspace.
    /// </remarks>
    [OpenApi]
    [HttpPut]
    [Authorize(Permissions.UpdateWorkspaceGeneralSettings)]
    public async Task<ApiResponse<WorkspaceVm>> UpdateAsync(UpdateWorkspace request)
    {
        request.Id = WorkspaceId;

        var workspace = await Mediator.Send(request);
        return Ok(workspace);
    }
}