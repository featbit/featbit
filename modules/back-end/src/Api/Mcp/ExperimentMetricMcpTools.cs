using System.ComponentModel;
using Api.Authorization;
using Application.Bases.Models;
using Application.Experiments;
using Application.Services;
using Domain.Policies;
using ModelContextProtocol.Server;

namespace Api.Mcp;

[McpServerToolType]
public class ExperimentMetricMcpTools(
    ISender mediator,
    IExperimentService experimentService,
    IHttpContextAccessor httpContextAccessor,
    IPermissionChecker permissionChecker)
{
    [McpServerTool(Name = "featbit_experiment_list_metrics")]
    [Description("List registered experiment metrics in the environment attached to a experiment experiment. Use this before selecting primary or guardrail metrics.")]
    public async Task<PagedResult<ExperimentMetricVm>> ListMetrics(
        [Description("Experiment experiment id used to resolve the FeatBit environment.")]
        Guid experimentId,
        [Description("Optional metric status filter: active or archived. Use empty string for all statuses.")]
        string status = "active",
        [Description("Optional metric key filter.")]
        string key = "",
        [Description("Page index, 1-based.")]
        int pageIndex = 1,
        [Description("Page size.")]
        int pageSize = 50)
    {
        var envId = await ResolveAuthorizedEnvIdAsync(experimentId);

        return await mediator.Send(new QueryExperimentMetrics
        {
            EnvId = envId,
            Filter = new ExperimentMetricFilter
            {
                Status = status,
                Key = key,
                PageIndex = pageIndex,
                PageSize = pageSize
            }
        });
    }

    [McpServerTool(Name = "featbit_experiment_create_metric")]
    [Description("Create a registered experiment metric key in the environment attached to a experiment experiment. Requires confirmedByUser=true after explicit user approval.")]
    public async Task<ExperimentMetricVm> CreateMetric(
        [Description("Experiment experiment id used to resolve the FeatBit environment.")]
        Guid experimentId,
        [Description("Metric creation payload.")]
        ExperimentMcpMetricUpdate request)
    {
        EnsureConfirmed(request);
        var envId = await ResolveAuthorizedEnvIdAsync(experimentId);

        return await mediator.Send(new CreateExperimentMetric
        {
            EnvId = envId,
            Update = request.ToMetricUpdate()
        });
    }

    [McpServerTool(Name = "featbit_experiment_update_metric")]
    [Description("Update a registered experiment metric key. Requires confirmedByUser=true after explicit user approval because experiments may depend on this metric.")]
    public async Task<ExperimentMetricVm> UpdateMetric(
        [Description("Experiment experiment id used to resolve the FeatBit environment.")]
        Guid experimentId,
        [Description("Experiment metric id.")]
        Guid metricId,
        [Description("Metric update payload.")]
        ExperimentMcpMetricUpdate request)
    {
        EnsureConfirmed(request);
        var envId = await ResolveAuthorizedEnvIdAsync(experimentId);

        return await mediator.Send(new UpdateExperimentMetric
        {
            EnvId = envId,
            Id = metricId,
            Update = request.ToMetricUpdate()
        });
    }

    [McpServerTool(Name = "featbit_experiment_archive_metric")]
    [Description("Archive a registered experiment metric key. Requires confirmedByUser=true after explicit user approval.")]
    public async Task<bool> ArchiveMetric(
        [Description("Experiment experiment id used to resolve the FeatBit environment.")]
        Guid experimentId,
        [Description("Experiment metric id.")]
        Guid metricId,
        [Description("Must be true only after the user explicitly approves archiving this metric.")]
        bool confirmedByUser)
    {
        if (!confirmedByUser)
        {
            throw new ArgumentException("confirmedByUser is required.");
        }

        var envId = await ResolveAuthorizedEnvIdAsync(experimentId);

        return await mediator.Send(new DeleteExperimentMetric
        {
            EnvId = envId,
            Id = metricId
        });
    }

    private static void EnsureConfirmed(ExperimentMcpMetricUpdate request)
    {
        if (request is null)
        {
            throw new ArgumentException("Metric request is required.");
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

public class ExperimentMcpMetricUpdate
{
    [Description("Must be true only after the user explicitly approves creating or updating this metric.")]
    public bool ConfirmedByUser { get; set; }

    [Description("Metric display name.")]
    public string Name { get; set; } = string.Empty;

    [Description("Stable event key used by SDK .track and analysis, for example checkout_completed.")]
    public string Key { get; set; } = string.Empty;

    [Description("Metric description.")]
    public string Description { get; set; } = string.Empty;

    [Description("Metric type: binary or continuous.")]
    public string MetricType { get; set; } = "binary";

    [Description("Aggregation: once, count, sum, or average. Binary metrics are analyzed as once.")]
    public string MetricAgg { get; set; } = "once";

    [Description("Metric status: active or archived. Defaults to active.")]
    public string Status { get; set; } = "active";

    public ExperimentMetricUpdate ToMetricUpdate() => new()
    {
        Name = Name,
        Key = Key,
        Description = Description,
        MetricType = MetricType,
        MetricAgg = MetricAgg,
        Status = Status
    };
}
