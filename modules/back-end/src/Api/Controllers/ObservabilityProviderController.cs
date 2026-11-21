using Api.Authentication;
using Application;
using Application.Bases.Exceptions;
using Application.ObservabilityProviders;
using Application.Services;
using Domain.AccessTokens;
using Domain.Environments;
using Domain.Policies;
using Domain.Resources;

namespace Api.Controllers;

[OpenApi]
[Route("api/v{version:apiVersion}/envs/{envId:guid}/observability-providers")]
public class ObservabilityProviderController(
    IEnvironmentService environmentService,
    IOrganizationService organizationService) : ApiControllerBase
{
    /// <summary>List observability providers in an environment.</summary>
    /// <remarks>Requires CanAccessEnv in the owning organization. Only active providers are returned.</remarks>
    [HttpGet]
    public async Task<ApiResponse<IEnumerable<ObservabilityProviderVm>>> GetListAsync(Guid envId)
    {
        await EnsureAccessAsync(envId);
        return Ok(await Mediator.Send(new GetObservabilityProviderList { EnvId = envId }, HttpContext.RequestAborted));
    }

    /// <summary>Get an observability provider and its non-sensitive connection settings.</summary>
    /// <remarks>Requires CanAccessEnv. Use the returned version as expectedVersion when updating.</remarks>
    /// <response code="404">The provider is missing or deleted in this environment.</response>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ApiResponse<ObservabilityProviderVm>> GetAsync(Guid envId, Guid id)
    {
        await EnsureAccessAsync(envId);
        return Ok(await Mediator.Send(new GetObservabilityProvider { EnvId = envId, Id = id }, HttpContext.RequestAborted));
    }

    /// <summary>Create an observability provider in an environment.</summary>
    /// <remarks>
    /// Requires CanAccessEnv and UpdateEnvSettings in the owning organization. Supply a name, providerType,
    /// providerConfig and authentication. The supported providerSchemaVersion is 1.
    /// For prometheus-compatible, set providerConfig.endpoint and choose authentication.type of none,
    /// bearer_token or basic. Basic also takes authentication.username.
    /// For azure-monitor, set providerConfig.workspaceId and supply authentication.mode of ClientSecret,
    /// tenantId and clientId. For authenticated connections, set secretUpdate.operation to replace and supply
    /// token, password or clientSecret in secretUpdate according to the authentication method.
    /// </remarks>
    /// <response code="400">The request is malformed or required fields are missing.</response>
    /// <response code="409">Another active provider has this name in the environment.</response>
    /// <response code="422">The provider configuration or credential change is invalid.</response>
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<ApiResponse<ObservabilityProviderVm>> CreateAsync(Guid envId, CreateObservabilityProvider request)
    {
        var environment = await EnsureAccessAsync(envId, manage: true);
        request.EnvId = envId;
        request.OrgId = environment.Organization.Id;
        request.ProjectId = environment.Project.Id;
        return Ok(await Mediator.Send(request, HttpContext.RequestAborted));
    }

    /// <summary>Update an observability provider's name and connection settings.</summary>
    /// <remarks>
    /// Requires CanAccessEnv and UpdateEnvSettings. Send the provider fields used for creation and
    /// the expectedVersion from the most recent read. Choose secretUpdate.operation of keep to retain
    /// a compatible configured credential, replace to supply a new one, or remove when switching
    /// the connection to unauthenticated access.
    /// </remarks>
    /// <response code="400">The request or expectedVersion is malformed.</response>
    /// <response code="404">The provider is missing or deleted in this environment.</response>
    /// <response code="409">The version is stale or another active provider has this name.</response>
    /// <response code="422">The provider configuration or credential change is invalid.</response>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<ApiResponse<ObservabilityProviderVm>> UpdateAsync(Guid envId, Guid id, UpdateObservabilityProvider request)
    {
        var environment = await EnsureAccessAsync(envId, manage: true);
        request.EnvId = envId;
        request.OrgId = environment.Organization.Id;
        request.ProjectId = environment.Project.Id;
        request.Id = id;
        return Ok(await Mediator.Send(request, HttpContext.RequestAborted));
    }

    /// <summary>Soft-delete an observability provider.</summary>
    /// <remarks>Requires CanAccessEnv and UpdateEnvSettings. Deleted providers are excluded from reads.</remarks>
    /// <response code="404">The provider is missing or already deleted in this environment.</response>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ApiResponse<bool>> DeleteAsync(Guid envId, Guid id)
    {
        await EnsureAccessAsync(envId, manage: true);
        return Ok(await Mediator.Send(new DeleteObservabilityProvider { EnvId = envId, Id = id }, HttpContext.RequestAborted));
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
