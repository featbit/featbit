using Api.Authentication;
using Application;
using Application.Bases.Exceptions;
using Application.ReleaseMetricSourceConnections;
using Application.Services;
using Domain.AccessTokens;
using Domain.Environments;
using Domain.Policies;
using Domain.Resources;

namespace Api.Controllers;

[OpenApi]
[Route("api/v{version:apiVersion}/envs/{envId:guid}/release-metric-source-connections")]
public class ReleaseMetricSourceConnectionController(
    IEnvironmentService environmentService,
    IOrganizationService organizationService) : ApiControllerBase
{
    /// <summary>List release metric source connections in an environment.</summary>
    /// <remarks>Requires CanAccessEnv in the owning organization. Only active connections are returned.</remarks>
    [HttpGet]
    public async Task<ApiResponse<IEnumerable<ReleaseMetricSourceConnectionVm>>> GetListAsync(Guid envId)
    {
        await EnsureAccessAsync(envId);
        return Ok(await Mediator.Send(new GetReleaseMetricSourceConnectionList { EnvId = envId }, HttpContext.RequestAborted));
    }

    /// <summary>Get a release metric source connection and its settings.</summary>
    /// <remarks>Requires CanAccessEnv.</remarks>
    /// <response code="404">The connection is missing or deleted in this environment.</response>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ApiResponse<ReleaseMetricSourceConnectionVm>> GetAsync(Guid envId, Guid id)
    {
        await EnsureAccessAsync(envId);
        return Ok(await Mediator.Send(new GetReleaseMetricSourceConnection { EnvId = envId, Id = id }, HttpContext.RequestAborted));
    }

    /// <summary>Create a release metric source connection in an environment.</summary>
    /// <remarks>
    /// Requires CanAccessEnv and UpdateEnvSettings. Supply public connection settings and use secretUpdate for write-only credentials.
    /// </remarks>
    /// <response code="400">The request is malformed or required fields are missing.</response>
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ApiResponse<ReleaseMetricSourceConnectionVm>> CreateAsync(Guid envId, CreateReleaseMetricSourceConnection request)
    {
        request.Scope = await EnsureAccessAsync(envId, manage: true);
        request.EnvId = envId;
        return Ok(await Mediator.Send(request, HttpContext.RequestAborted));
    }

    /// <summary>Update a release metric source connection's name and settings.</summary>
    /// <remarks>
    /// Requires CanAccessEnv and UpdateEnvSettings. Omit fields to keep their stored values. Use secretUpdate to replace credentials.
    /// </remarks>
    /// <response code="400">The request is malformed or required fields are missing.</response>
    /// <response code="404">The connection is missing or deleted in this environment.</response>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ApiResponse<ReleaseMetricSourceConnectionVm>> UpdateAsync(Guid envId, Guid id, UpdateReleaseMetricSourceConnection request)
    {
        request.Scope = await EnsureAccessAsync(envId, manage: true);
        request.EnvId = envId;
        request.Id = id;
        return Ok(await Mediator.Send(request, HttpContext.RequestAborted));
    }

    /// <summary>Soft-delete a release metric source connection.</summary>
    /// <remarks>Requires CanAccessEnv and UpdateEnvSettings. Deleted connections are excluded from reads.</remarks>
    /// <response code="404">The connection is missing or already deleted in this environment.</response>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ApiResponse<bool>> DeleteAsync(Guid envId, Guid id)
    {
        await EnsureAccessAsync(envId, manage: true);
        return Ok(await Mediator.Send(new DeleteReleaseMetricSourceConnection { EnvId = envId, Id = id }, HttpContext.RequestAborted));
    }

    private async Task<ResourceDescriptor> EnsureAccessAsync(Guid envId, bool manage = false)
    {
        // Environment resource names contain the project and environment keys, both local to an organization.
        var descriptor = await environmentService.GetResourceDescriptorAsync(envId);
        if (descriptor == null || descriptor.Organization.Id != OrgId)
        {
            throw new ForbiddenException();
        }

        // JWT membership is checked by tenant middleware. A personal access token acts for its creator.
        if (HttpContext.Items[ApplicationConsts.AccessTokenItem] is AccessToken { Type: AccessTokenTypes.Personal } token &&
            !await organizationService.ContainsUserAsync(OrgId, token.CreatorId))
        {
            throw new ForbiddenException();
        }

        var rn = RN.ForEnv(descriptor.Project.Key, descriptor.Environment.Key);
        var permissions = await GetRequestPermissionsAsync();
        if (!PolicyHelper.IsAllowed(permissions, rn, Permissions.CanAccessEnv) ||
            (manage && !PolicyHelper.IsAllowed(permissions, rn, Permissions.UpdateEnvSettings)))
        {
            throw new ForbiddenException();
        }

        return descriptor;
    }
}
