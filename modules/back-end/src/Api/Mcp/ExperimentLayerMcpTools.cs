using System.ComponentModel;
using Api.Authorization;
using Application.Bases.Models;
using Application.Experiments;
using Application.Services;
using Domain.Policies;
using ModelContextProtocol.Server;

namespace Api.Mcp;

[McpServerToolType]
public class ExperimentLayerMcpTools(
    ISender mediator,
    IExperimentService experimentService,
    IHttpContextAccessor httpContextAccessor,
    IPermissionChecker permissionChecker)
{
    [McpServerTool(Name = "featbit_experiment_list_layers")]
    [Description("List registered experiment layers in the environment attached to a experiment experiment.")]
    public async Task<PagedResult<ExperimentLayerVm>> ListLayers(
        [Description("Experiment experiment id used to resolve the FeatBit environment.")]
        Guid experimentId,
        [Description("Optional layer status filter: active or archived.")]
        string status = "active",
        [Description("Optional layer key filter.")]
        string key = "",
        [Description("Page index, 1-based.")]
        int pageIndex = 1,
        [Description("Page size.")]
        int pageSize = 50)
    {
        var envId = await ResolveAuthorizedEnvIdAsync(experimentId);

        return await mediator.Send(new QueryExperimentLayers
        {
            EnvId = envId,
            Filter = new ExperimentLayerFilter
            {
                Status = status,
                Key = key,
                PageIndex = pageIndex,
                PageSize = pageSize
            }
        });
    }

    [McpServerTool(Name = "featbit_experiment_create_layer")]
    [Description("Create a registered experiment layer in the environment attached to a experiment experiment. Requires confirmedByUser=true after explicit user approval.")]
    public async Task<ExperimentLayerVm> CreateLayer(
        [Description("Experiment experiment id used to resolve the FeatBit environment.")]
        Guid experimentId,
        [Description("Layer creation payload.")]
        ExperimentMcpLayerUpdate request)
    {
        EnsureConfirmed(request);
        var envId = await ResolveAuthorizedEnvIdAsync(experimentId);

        return await mediator.Send(new CreateExperimentLayer
        {
            EnvId = envId,
            Update = request.ToLayerUpdate()
        });
    }

    [McpServerTool(Name = "featbit_experiment_update_layer")]
    [Description("Update a registered experiment layer. Requires confirmedByUser=true after explicit user approval because active runs may depend on this layer.")]
    public async Task<ExperimentLayerVm> UpdateLayer(
        [Description("Experiment experiment id used to resolve the FeatBit environment.")]
        Guid experimentId,
        [Description("Experiment layer id.")]
        Guid layerId,
        [Description("Layer update payload.")]
        ExperimentMcpLayerUpdate request)
    {
        EnsureConfirmed(request);
        var envId = await ResolveAuthorizedEnvIdAsync(experimentId);

        return await mediator.Send(new UpdateExperimentLayer
        {
            EnvId = envId,
            Id = layerId,
            Update = request.ToLayerUpdate()
        });
    }

    [McpServerTool(Name = "featbit_experiment_archive_layer")]
    [Description("Archive a registered experiment layer. Requires confirmedByUser=true after explicit user approval.")]
    public async Task<bool> ArchiveLayer(
        [Description("Experiment experiment id used to resolve the FeatBit environment.")]
        Guid experimentId,
        [Description("Experiment layer id.")]
        Guid layerId,
        [Description("Must be true only after the user explicitly approves archiving this layer.")]
        bool confirmedByUser)
    {
        if (!confirmedByUser)
        {
            throw new ArgumentException("confirmedByUser is required.");
        }

        var envId = await ResolveAuthorizedEnvIdAsync(experimentId);

        return await mediator.Send(new DeleteExperimentLayer
        {
            EnvId = envId,
            Id = layerId
        });
    }

    private static void EnsureConfirmed(ExperimentMcpLayerUpdate request)
    {
        if (request is null)
        {
            throw new ArgumentException("Layer request is required.");
        }

        if (!request.ConfirmedByUser)
        {
            throw new ArgumentException("confirmedByUser is required.");
        }
    }

    private async Task<Guid> ResolveAuthorizedEnvIdAsync(Guid experimentId)
    {
        var envId = await experimentService.GetEnvIdAsync(experimentId);
        await EnsureCanAccessEnvPermissionAsync(envId);
        return envId;
    }

    private async Task EnsureCanAccessEnvPermissionAsync(Guid envId)
    {
        var httpContext = httpContextAccessor.HttpContext
                          ?? throw new InvalidOperationException("MCP request context is unavailable.");

        httpContext.Request.RouteValues["envId"] = envId.ToString();
        var requirement = new PermissionRequirement(Permissions.CanAccessEnv);

        if (!await permissionChecker.IsGrantedAsync(httpContext, requirement))
        {
            throw new UnauthorizedAccessException($"Current principal cannot access environment {envId}.");
        }
    }
}

public class ExperimentMcpLayerUpdate
{
    [Description("Must be true only after the user explicitly approves creating or updating this layer.")]
    public bool ConfirmedByUser { get; set; }

    [Description("Layer display name.")]
    public string Name { get; set; } = string.Empty;

    [Description("Stable layer key used for bucket hashing and mutual-exclusion grouping.")]
    public string Key { get; set; } = string.Empty;

    [Description("Layer description.")]
    public string Description { get; set; } = string.Empty;

    [Description("Assignment unit selector shared by runs in this layer. Defaults to user.keyId.")]
    public string AssignmentUnitSelector { get; set; } = "user.keyId";

    [Description("Layer status: active or archived. Defaults to active.")]
    public string Status { get; set; } = "active";

    public ExperimentLayerUpdate ToLayerUpdate() => new()
    {
        Name = Name,
        Key = Key,
        Description = Description,
        AssignmentUnitSelector = AssignmentUnitSelector,
        Status = Status
    };
}
