using System.ComponentModel;
using Api.Authorization;
using Application.Bases.Models;
using Application.ReleaseDecisions;
using Application.Services;
using Domain.Policies;
using ModelContextProtocol.Server;

namespace Api.Mcp;

[McpServerToolType]
public class ReleaseDecisionMetricMcpTools(
    ISender mediator,
    IReleaseDecisionExperimentService experimentService,
    IHttpContextAccessor httpContextAccessor,
    IPermissionChecker permissionChecker)
{
    [McpServerTool(Name = "featbit_release_decision_list_metrics")]
    [Description("List registered release-decision metrics in the environment attached to a release-decision experiment. Use this before selecting primary or guardrail metrics.")]
    public async Task<PagedResult<ReleaseDecisionMetricVm>> ListMetrics(
        [Description("Release-decision experiment id used to resolve the FeatBit environment.")]
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

        return await mediator.Send(new QueryReleaseDecisionMetrics
        {
            EnvId = envId,
            Filter = new ReleaseDecisionMetricFilter
            {
                Status = status,
                Key = key,
                PageIndex = pageIndex,
                PageSize = pageSize
            }
        });
    }

    [McpServerTool(Name = "featbit_release_decision_create_metric")]
    [Description("Create a registered release-decision metric key in the environment attached to a release-decision experiment. Requires confirmedByUser=true after explicit user approval.")]
    public async Task<ReleaseDecisionMetricVm> CreateMetric(
        [Description("Release-decision experiment id used to resolve the FeatBit environment.")]
        Guid experimentId,
        [Description("Metric creation payload.")]
        ReleaseDecisionMcpMetricUpdate request)
    {
        EnsureConfirmed(request);
        var envId = await ResolveAuthorizedEnvIdAsync(experimentId);

        return await mediator.Send(new CreateReleaseDecisionMetric
        {
            EnvId = envId,
            Update = request.ToMetricUpdate()
        });
    }

    [McpServerTool(Name = "featbit_release_decision_update_metric")]
    [Description("Update a registered release-decision metric key. Requires confirmedByUser=true after explicit user approval because experiments may depend on this metric.")]
    public async Task<ReleaseDecisionMetricVm> UpdateMetric(
        [Description("Release-decision experiment id used to resolve the FeatBit environment.")]
        Guid experimentId,
        [Description("Release-decision metric id.")]
        Guid metricId,
        [Description("Metric update payload.")]
        ReleaseDecisionMcpMetricUpdate request)
    {
        EnsureConfirmed(request);
        var envId = await ResolveAuthorizedEnvIdAsync(experimentId);

        return await mediator.Send(new UpdateReleaseDecisionMetric
        {
            EnvId = envId,
            Id = metricId,
            Update = request.ToMetricUpdate()
        });
    }

    [McpServerTool(Name = "featbit_release_decision_archive_metric")]
    [Description("Archive a registered release-decision metric key. Requires confirmedByUser=true after explicit user approval.")]
    public async Task<bool> ArchiveMetric(
        [Description("Release-decision experiment id used to resolve the FeatBit environment.")]
        Guid experimentId,
        [Description("Release-decision metric id.")]
        Guid metricId,
        [Description("Must be true only after the user explicitly approves archiving this metric.")]
        bool confirmedByUser)
    {
        if (!confirmedByUser)
        {
            throw new ArgumentException("confirmedByUser is required.");
        }

        var envId = await ResolveAuthorizedEnvIdAsync(experimentId);

        return await mediator.Send(new DeleteReleaseDecisionMetric
        {
            EnvId = envId,
            Id = metricId
        });
    }

    private static void EnsureConfirmed(ReleaseDecisionMcpMetricUpdate request)
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

public class ReleaseDecisionMcpMetricUpdate
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

    public ReleaseDecisionMetricUpdate ToMetricUpdate() => new()
    {
        Name = Name,
        Key = Key,
        Description = Description,
        MetricType = MetricType,
        MetricAgg = MetricAgg,
        Status = Status
    };
}
