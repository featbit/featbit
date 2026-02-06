using Api.Authentication;
using Api.Authorization;
using Application.Projects;
using Domain.Projects;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/projects")]
public class ProjectController : ApiControllerBase
{
    /// <summary>
    /// Get a project
    /// </summary>
    /// <remarks>
    /// Get a single project by ID with its environments.
    /// </remarks>
    [OpenApi]
    [HttpGet]
    [Route("{projectId:guid}")]
    [Authorize(Permissions.CanAccessProject)]
    public async Task<ApiResponse<ProjectWithEnvs>> GetAsync(Guid projectId)
    {
        var request = new GetProject
        {
            Id = projectId
        };

        var project = await Mediator.Send(request);
        return Ok(project);
    }

    /// <summary>
    /// Get project list of an organization
    /// </summary>
    /// <remarks>
    /// Get the list of all projects within the current organization.
    /// </remarks>
    [OpenApi]
    [HttpGet]
    [Authorize(Permissions.CanAccessProject)]
    public async Task<ApiResponse<IEnumerable<ProjectWithEnvs>>> GetListAsync()
    {
        var request = new GetProjectList
        {
            OrganizationId = OrgId
        };

        var projects = await Mediator.Send(request);
        return Ok(projects);
    }

    /// <summary>
    /// Create a project
    /// </summary>
    /// <remarks>
    /// Create a new project with the given name and key.
    /// </remarks>
    [OpenApi]
    [HttpPost]
    [Authorize(Permissions.CreateProject)]
    public async Task<ApiResponse<ProjectWithEnvs>> CreateAsync(CreateProject request)
    {
        request.OrganizationId = OrgId;

        var projectWithEnvs = await Mediator.Send(request);
        return Ok(projectWithEnvs);
    }

    /// <summary>
    /// Update a project
    /// </summary>
    /// <remarks>
    /// Update the name of an existing project.
    /// </remarks>
    [OpenApi]
    [HttpPut("{id:guid}")]
    [Authorize(Permissions.UpdateProjectSettings)]
    public async Task<ApiResponse<ProjectVm>> UpdateAsync(Guid id, UpdateProject request)
    {
        request.Id = id;

        var project = await Mediator.Send(request);
        return Ok(project);
    }

    /// <summary>
    /// Delete a project
    /// </summary>
    /// <remarks>
    /// Permanently delete a project and all its associated data. This action cannot be undone.
    /// </remarks>
    [OpenApi]
    [HttpDelete]
    [Route("{id:guid}")]
    [Authorize(Permissions.DeleteProject)]
    public async Task<ApiResponse<bool>> DeleteAsync(Guid id)
    {
        var request = new DeleteProject
        {
            Id = id
        };

        var success = await Mediator.Send(request);
        return Ok(success);
    }

    /// <summary>
    /// Check if a project key is already used
    /// </summary>
    /// <remarks>
    /// Check whether the given key is already used by another project in the organization.
    /// </remarks>
    [HttpGet("is-key-used")]
    public async Task<ApiResponse<bool>> IsKeyUsedAsync(string key)
    {
        var request = new IsKeyUsed
        {
            OrganizationId = OrgId,
            Key = key
        };

        var isUsed = await Mediator.Send(request);
        return Ok(isUsed);
    }
}