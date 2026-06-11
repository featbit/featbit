using System.ComponentModel;
using Api.Authorization;
using Application.ReleaseDecisions;
using Application.Services;
using Domain.Policies;
using ModelContextProtocol.Server;

namespace Api.Mcp;

[McpServerToolType]
public class ReleaseDecisionMcpTools(
    ISender mediator,
    IReleaseDecisionExperimentService experimentService,
    IHttpContextAccessor httpContextAccessor,
    IPermissionChecker permissionChecker)
{
    [McpServerTool(Name = "featbit_release_decision_get_experiment")]
    [Description("Read a release-decision experiment by id, including runs, activities, and messages. The API resolves the FeatBit environment from the experiment.")]
    public async Task<ReleaseDecisionExperimentDetailVm> GetExperiment(
        [Description("Release-decision experiment id.")]
        Guid experimentId)
    {
        var envId = await ResolveAuthorizedEnvIdAsync(experimentId);

        return await mediator.Send(new GetReleaseDecisionExperiment
        {
            EnvId = envId,
            Id = experimentId
        });
    }

    [McpServerTool(Name = "featbit_release_decision_update_experiment")]
    [Description("Patch release-decision experiment fields such as goal, intent, hypothesis, constraints, learning, and last action. Use featbit_release_decision_update_metrics for primary metrics and guardrails. The API resolves the FeatBit environment from the experiment.")]
    public async Task<ReleaseDecisionExperimentDetailVm> UpdateExperiment(
        [Description("Release-decision experiment id.")]
        Guid experimentId,
        [Description("Partial experiment update. Leave fields null when they should not change.")]
        ReleaseDecisionExperimentUpdate update)
    {
        var envId = await ResolveAuthorizedEnvIdAsync(experimentId);

        return await mediator.Send(new UpdateReleaseDecisionExperiment
        {
            EnvId = envId,
            Id = experimentId,
            Update = update
        });
    }

    [McpServerTool(Name = "featbit_release_decision_set_stage")]
    [Description("Move a release-decision experiment to a framework stage such as intent, hypothesis, implementing, measuring, or learning.")]
    public async Task<ReleaseDecisionExperimentDetailVm> SetStage(
        [Description("Release-decision experiment id.")]
        Guid experimentId,
        [Description("Target release-decision stage.")]
        string stage)
    {
        var envId = await ResolveAuthorizedEnvIdAsync(experimentId);

        return await mediator.Send(new UpdateReleaseDecisionExperimentStage
        {
            EnvId = envId,
            Id = experimentId,
            Stage = stage
        });
    }

    [McpServerTool(Name = "featbit_release_decision_update_metrics")]
    [Description("Update the complete primary metric contract and guardrail metric configuration for a release-decision experiment. Primary metric requires metricName, metricEvent, metricType, metricAgg, and expectedDirection (increase_good or decrease_good).")]
    public async Task<ReleaseDecisionExperimentDetailVm> UpdateMetrics(
        [Description("Release-decision experiment id.")]
        Guid experimentId,
        [Description("Primary metric and guardrail update payload.")]
        ReleaseDecisionMetricsUpdate update)
    {
        var envId = await ResolveAuthorizedEnvIdAsync(experimentId);

        return await mediator.Send(new UpdateReleaseDecisionMetrics
        {
            EnvId = envId,
            Id = experimentId,
            Update = update
        });
    }

    [McpServerTool(Name = "featbit_release_decision_create_run")]
    [Description("Create a new release-decision experiment run.")]
    public async Task<ReleaseDecisionExperimentDetailVm> CreateRun(
        [Description("Release-decision experiment id.")]
        Guid experimentId)
    {
        var envId = await ResolveAuthorizedEnvIdAsync(experimentId);

        return await mediator.Send(new CreateReleaseDecisionExperimentRun
        {
            EnvId = envId,
            Id = experimentId
        });
    }

    [McpServerTool(Name = "featbit_release_decision_update_run")]
    [Description("Patch a release-decision experiment run, including method, metrics, variants, observations, input data, analysis result, decision, or learning fields.")]
    public async Task<ReleaseDecisionExperimentDetailVm> UpdateRun(
        [Description("Release-decision experiment id.")]
        Guid experimentId,
        [Description("Release-decision experiment run id.")]
        Guid runId,
        [Description("Partial run update. Leave fields null when they should not change.")]
        ReleaseDecisionExperimentRunUpdate update)
    {
        var envId = await ResolveAuthorizedEnvIdAsync(experimentId);

        return await mediator.Send(new UpdateReleaseDecisionExperimentRun
        {
            EnvId = envId,
            Id = experimentId,
            RunId = runId,
            Update = update
        });
    }

    [McpServerTool(Name = "featbit_release_decision_analyze_run")]
    [Description("Run server-side analysis for a release-decision experiment run and return the refreshed experiment.")]
    public async Task<ReleaseDecisionExperimentDetailVm> AnalyzeRun(
        [Description("Release-decision experiment id.")]
        Guid experimentId,
        [Description("Release-decision experiment run id.")]
        Guid runId,
        [Description("When true, fetch fresh stats instead of reusing existing analysis input where possible.")]
        bool forceFresh = false)
    {
        var envId = await ResolveAuthorizedEnvIdAsync(experimentId);

        return await mediator.Send(new AnalyzeReleaseDecisionExperimentRun
        {
            EnvId = envId,
            Id = experimentId,
            RunId = runId,
            Request = new ReleaseDecisionExperimentRunAnalyzeRequest { ForceFresh = forceFresh }
        });
    }

    [McpServerTool(Name = "featbit_release_decision_add_message")]
    [Description("Append an assistant/user/system message to a release-decision experiment conversation history.")]
    public async Task<ReleaseDecisionExperimentDetailVm> AddMessage(
        [Description("Release-decision experiment id.")]
        Guid experimentId,
        [Description("Message role, for example user, assistant, or system.")]
        string role,
        [Description("Message content.")]
        string content,
        [Description("Optional JSON metadata.")]
        string? metadata = null)
    {
        var envId = await ResolveAuthorizedEnvIdAsync(experimentId);

        return await mediator.Send(new CreateReleaseDecisionExperimentMessage
        {
            EnvId = envId,
            Id = experimentId,
            Message = new ReleaseDecisionExperimentMessageCreation
            {
                Role = role,
                Content = content,
                Metadata = metadata
            }
        });
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
