using Api.Authentication;
using Application.Workspaces;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/workspaces")]
public class WorkspaceController : ApiControllerBase
{
    /// <summary>
    /// Get a workspace
    /// </summary>
    /// <remarks>
    /// Get a workspace by id.
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
    
    [HttpPut("license")]
    public async Task<ApiResponse<WorkspaceVm>> UpdateLicenseAsync(UpdateLicense request)
    {
        request.Id = WorkspaceId;
        
        var organization = await Mediator.Send(request);
        return Ok(organization);
    }
    
    [HttpPut("sso-oidc")]
    public async Task<ApiResponse<WorkspaceVm>> UpdateOidcAsync(UpdateSsoOidc request)
    {
        request.Id = WorkspaceId;
        
        var organization = await Mediator.Send(request);
        return Ok(organization);
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
    
    [HttpPut]
    public async Task<ApiResponse<WorkspaceVm>> UpdateAsync(UpdateWorkspace request)
    {
        request.Id = WorkspaceId;

        var organization = await Mediator.Send(request);
        return Ok(organization);
    }
    
    [AllowAnonymous]
    [HttpPost("has-multiple-workspaces")]
    public async Task<ApiResponse<bool>> GetAsync(HasMultipleWorkspaces request)
    {
        var vm = await Mediator.Send(request);
        return Ok(vm);
    }
}