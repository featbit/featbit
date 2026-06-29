using System.ComponentModel;
using System.Text.Json;
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
    [Description("Read a release-decision experiment by id, including runs and activities. The API resolves the FeatBit environment from the experiment.")]
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

    [McpServerTool(Name = "featbit_release_decision_update_run_traffic")]
    [Description("Configure experiment traffic assignment for a release-decision run. Feature flag evaluation decides the served variation; layer only gates eligibility; analysis sampling happens inside each actual served variation. Supports layer id/key, assignment unit, bucket slice start/end, traffic offset, allocation plan, audience filters, and analysis sampling plan. Choose includeRate from the actual exposure distribution in the run window: includeRate = desired analyzed users for that variation / observed served users for that variation * 100, capped at 100. If the run is already collecting, analyzing, or decided, set confirmedByUser true only after the user explicitly approves changing evidence scope.")]
    public async Task<ReleaseDecisionExperimentDetailVm> UpdateRunTraffic(
        [Description("Release-decision experiment id.")]
        Guid experimentId,
        [Description("Release-decision experiment run id.")]
        Guid runId,
        [Description("Run traffic/sampling update. Requires controlVariant, treatmentVariant, assignmentUnitSelector, layerTrafficPercent, and analysisSamplingPlan. Use sliceStart/sliceEnd for explicit layer bucket ranges such as 30-60.")]
        ReleaseDecisionMcpRunTrafficRequest request)
    {
        var envId = await ResolveAuthorizedEnvIdAsync(experimentId);
        var experiment = await experimentService.GetAsync(envId, experimentId);
        var run = experiment.ExperimentRuns.FirstOrDefault(x => x.Id == runId)
                  ?? throw new InvalidOperationException($"Run {runId} was not found in experiment {experimentId}.");

        ValidateRunTrafficRequest(request, run);

        return await mediator.Send(new UpdateReleaseDecisionExperimentRunAudience
        {
            EnvId = envId,
            Id = experimentId,
            RunId = runId,
            Update = new ReleaseDecisionExperimentRunAudienceUpdate
            {
                Method = request.Method,
                ControlVariant = request.ControlVariant,
                TreatmentVariant = request.TreatmentVariant,
                TrafficPercent = request.TrafficPercent,
                TrafficOffset = request.TrafficOffset,
                LayerId = request.LayerId ?? request.LayerKey,
                LayerKey = request.LayerKey ?? request.LayerId,
                AllocationKeySelector = request.AllocationKeySelector,
                SliceStart = request.SliceStart,
                SliceEnd = request.SliceEnd,
                AssignmentUnitSelector = request.AssignmentUnitSelector,
                LayerTrafficPercent = request.LayerTrafficPercent,
                AllocationPlan = request.AllocationPlan,
                AnalysisSamplingPlan = request.AnalysisSamplingPlan,
                AudienceFilters = request.AudienceFilters,
            }
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

    private static void ValidateRunTrafficRequest(
        ReleaseDecisionMcpRunTrafficRequest request,
        ReleaseDecisionExperimentRunVm run)
    {
        if (request is null)
        {
            throw new ArgumentException("Run traffic request is required.");
        }

        var method = Normalize(request.Method) ?? "bayesian_ab";
        if (method is not ("bayesian_ab" or "bandit"))
        {
            throw new ArgumentException("method must be bayesian_ab or bandit.");
        }

        if (string.IsNullOrWhiteSpace(request.ControlVariant))
        {
            throw new ArgumentException("controlVariant is required.");
        }

        var treatments = SplitVariantList(request.TreatmentVariant);
        if (treatments.Length == 0)
        {
            throw new ArgumentException("treatmentVariant must include at least one treatment variation.");
        }

        var assignmentUnitSelector = Normalize(request.AssignmentUnitSelector);
        if (assignmentUnitSelector is null)
        {
            throw new ArgumentException("assignmentUnitSelector is required. Use user.keyId or an event property name.");
        }

        if (assignmentUnitSelector.Any(char.IsWhiteSpace))
        {
            throw new ArgumentException("assignmentUnitSelector cannot contain whitespace.");
        }

        if (request.LayerTrafficPercent is < 0 or > 100)
        {
            throw new ArgumentException("layerTrafficPercent must be between 0 and 100.");
        }

        if (request.TrafficPercent is < 1 or > 100)
        {
            throw new ArgumentException("trafficPercent must be between 1 and 100.");
        }

        if (request.TrafficOffset is < 0 or > 99)
        {
            throw new ArgumentException("trafficOffset must be between 0 and 99.");
        }

        if (request.SliceStart is < 0 or > 100)
        {
            throw new ArgumentException("sliceStart must be between 0 and 100.");
        }

        if (request.SliceEnd is < 0 or > 100)
        {
            throw new ArgumentException("sliceEnd must be between 0 and 100.");
        }

        if (request.SliceStart.HasValue && request.SliceEnd.HasValue && request.SliceEnd <= request.SliceStart)
        {
            throw new ArgumentException("sliceEnd must be greater than sliceStart.");
        }

        var planEntries = ParseSamplingPlan(request.AnalysisSamplingPlan);
        var control = Normalize(request.ControlVariant)!;
        var planControl = planEntries.Count(x => x.Role == "control" && x.Variation == control);
        if (planControl != 1)
        {
            throw new ArgumentException("analysisSamplingPlan must contain exactly one control entry matching controlVariant.");
        }

        var treatmentSet = treatments.Select(Normalize).Where(x => x is not null).ToHashSet();
        var treatmentEntries = planEntries
            .Where(x => x.Role == "treatment" && treatmentSet.Contains(x.Variation))
            .Select(x => x.Variation)
            .ToHashSet();
        if (!treatmentSet.SetEquals(treatmentEntries))
        {
            throw new ArgumentException("analysisSamplingPlan must contain one treatment entry for every treatmentVariant.");
        }

        var evidenceSensitive = Normalize(run.Status) is "collecting" or "analyzing" or "decided";
        if (evidenceSensitive && request.ConfirmedByUser != true)
        {
            throw new InvalidOperationException("Changing traffic/sampling for a collecting, analyzing, or decided run requires confirmedByUser=true after explicit user approval.");
        }
    }

    private static SamplingPlanEntry[] ParseSamplingPlan(string analysisSamplingPlan)
    {
        if (string.IsNullOrWhiteSpace(analysisSamplingPlan))
        {
            throw new ArgumentException("analysisSamplingPlan is required.");
        }

        try
        {
            using var document = JsonDocument.Parse(analysisSamplingPlan);
            if (document.RootElement.ValueKind != JsonValueKind.Array)
            {
                throw new ArgumentException("analysisSamplingPlan must be a JSON array.");
            }

            var entries = new List<SamplingPlanEntry>();
            foreach (var item in document.RootElement.EnumerateArray())
            {
                var variation = Normalize(GetJsonString(item, "variation"));
                var role = Normalize(GetJsonString(item, "role")) ?? "treatment";
                if (variation is null)
                {
                    throw new ArgumentException("Each analysisSamplingPlan entry requires variation.");
                }

                if (role is not ("control" or "treatment" or "holdout" or "exclude"))
                {
                    throw new ArgumentException("Sampling plan role must be control, treatment, holdout, or exclude.");
                }

                if (!TryGetJsonDouble(item, "includeRate", out var includeRate))
                {
                    includeRate = 100;
                }

                if (includeRate is < 0 or > 100)
                {
                    throw new ArgumentException("Sampling plan includeRate must be between 0 and 100.");
                }

                entries.Add(new SamplingPlanEntry(variation, role, includeRate));
            }

            if (entries.Count == 0)
            {
                throw new ArgumentException("analysisSamplingPlan must contain at least one entry.");
            }

            return entries.ToArray();
        }
        catch (JsonException ex)
        {
            throw new ArgumentException("analysisSamplingPlan must be valid JSON.", ex);
        }
    }

    private static string[] SplitVariantList(string variants)
    {
        return (variants ?? string.Empty)
            .Split([',', ';', '|'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Where(x => !string.IsNullOrWhiteSpace(x))
            .ToArray();
    }

    private static string? Normalize(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    private static string? GetJsonString(JsonElement element, string propertyName)
    {
        return element.TryGetProperty(propertyName, out var property) && property.ValueKind == JsonValueKind.String
            ? property.GetString()
            : null;
    }

    private static bool TryGetJsonDouble(JsonElement element, string propertyName, out double value)
    {
        value = 0;
        return element.TryGetProperty(propertyName, out var property) &&
               property.TryGetDouble(out value);
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

    private sealed record SamplingPlanEntry(string Variation, string Role, double IncludeRate);
}

public class ReleaseDecisionMcpRunTrafficRequest
{
    [Description("Run method. Use bayesian_ab for fixed control/treatment analysis or bandit for adaptive arms.")]
    public string Method { get; set; } = string.Empty;

    [Description("Control or baseline variation value exactly as served by FeatBit exposure events.")]
    public string ControlVariant { get; set; } = string.Empty;

    [Description("One or more treatment variation values exactly as served by FeatBit exposure events. Separate multiple values with commas.")]
    public string TreatmentVariant { get; set; } = string.Empty;

    [Description("Optional mutual-exclusion layer key. The layer gates eligibility only and does not decide the served variation.")]
    public string LayerKey { get; set; } = string.Empty;

    [Description("Optional mutual-exclusion layer id. Prefer layerKey when the user is selecting by registered layer key.")]
    public string LayerId { get; set; } = string.Empty;

    [Description("Legacy analysis traffic percentage, from 1 to 100. Prefer sliceStart/sliceEnd plus layerTrafficPercent for layer bucket assignments.")]
    public double? TrafficPercent { get; set; }

    [Description("Legacy analysis traffic offset bucket, from 0 to 99. Prefer sliceStart/sliceEnd for explicit bucket assignments.")]
    public int? TrafficOffset { get; set; }

    [Description("Optional allocation key selector retained for backward compatibility. Prefer assignmentUnitSelector.")]
    public string AllocationKeySelector { get; set; } = string.Empty;

    [Description("Inclusive bucket start for the layer eligibility slice, from 0 to 100.")]
    public double? SliceStart { get; set; }

    [Description("Exclusive bucket end for the layer eligibility slice, from 0 to 100 and greater than sliceStart.")]
    public double? SliceEnd { get; set; }

    [Description("Assignment unit selector. Use user.keyId for event user_key, or a custom event property name that exists on exposure and metric events.")]
    public string AssignmentUnitSelector { get; set; } = string.Empty;

    [Description("Percentage of assignment units eligible for this run inside the layer, from 0 to 100.")]
    public double? LayerTrafficPercent { get; set; }

    [Description("JSON array of { variation, role, includeRate, label? }. Sampling is applied inside each actual served variation.")]
    public string AnalysisSamplingPlan { get; set; } = string.Empty;

    [Description("Optional legacy JSON allocation plan. Prefer analysisSamplingPlan unless intentionally reproducing allocation-plan behavior.")]
    public string AllocationPlan { get; set; } = string.Empty;

    [Description("Optional audience filters stored on the run for operator visibility.")]
    public string AudienceFilters { get; set; } = string.Empty;

    [Description("Set true only after the user explicitly approves changing traffic/sampling for a collecting, analyzing, or decided run.")]
    public bool? ConfirmedByUser { get; set; }
}
