using Api.Authentication;
using Api.Authorization;
using Application.Environments;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/projects/{projectId:guid}/envs")]
public class EnvironmentController : ApiControllerBase
{
    /// <summary>
    /// Get an environment
    /// </summary>
    /// <remarks>
    /// Get a single environment by ID.
    /// </remarks>
    [OpenApi]
    [HttpGet]
    [Route("{envId:guid}")]
    [Authorize(Permissions.CanAccessEnv)]
    public async Task<ApiResponse<EnvironmentVm>> GetAsync(Guid envId)
    {
        var request = new GetEnvironment
        {
            Id = envId
        };

        var project = await Mediator.Send(request);
        return Ok(project);
    }

    /// <summary>
    /// Create an environment
    /// </summary>
    /// <remarks>
    /// Create a new environment with the given name, key and description.
    /// </remarks>
    [OpenApi]
    [HttpPost]
    [Authorize(Permissions.CreateEnv)]
    public async Task<ApiResponse<EnvironmentVm>> CreateAsync(Guid projectId, CreateEnvironment request)
    {
        request.ProjectId = projectId;

        var env = await Mediator.Send(request);
        return Ok(env);
    }

    /// <summary>
    /// Update an environment
    /// </summary>
    /// <remarks>
    /// Update the name and description of an existing environment.
    /// </remarks>
    [OpenApi]
    [HttpPut("{id:guid}")]
    [Authorize(Permissions.UpdateEnvSettings)]
    public async Task<ApiResponse<EnvironmentVm>> UpdateAsync(Guid id, UpdateEnvironment request)
    {
        request.Id = id;

        var env = await Mediator.Send(request);
        return Ok(env);
    }

    /// <summary>
    /// Delete an environment
    /// </summary>
    /// <remarks>
    /// Permanently delete an environment and all its associated data. This action cannot be undone.
    /// </remarks>
    [OpenApi]
    [HttpDelete("{id:guid}")]
    [Authorize(Permissions.DeleteEnv)]
    public async Task<ApiResponse<bool>> DeleteAsync(Guid id)
    {
        var request = new DeleteEnvironment
        {
            Id = id
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    [HttpGet("is-key-used")]
    public async Task<ApiResponse<bool>> IsKeyUsedAsync(Guid projectId, string key)
    {
        var request = new IsKeyUsed
        {
            ProjectId = projectId,
            Key = key
        };

        var isUsed = await Mediator.Send(request);
        return Ok(isUsed);
    }
}