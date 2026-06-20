using Application.Bases.Models;
using Application.ReleaseDecisions;
using Application.Services;
using Domain.ReleaseDecisions;

namespace Application.IntegrationTests.Stubs;

public class TestReleaseDecisionExperimentService : IReleaseDecisionExperimentService
{
    public static readonly Guid ExperimentId = new("10000000-0000-0000-0000-000000000001");
    public static readonly Guid RunId = new("20000000-0000-0000-0000-000000000001");
    private static readonly DateTime CreatedAt = new(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime UpdatedAt = new(2026, 6, 2, 0, 0, 0, DateTimeKind.Utc);

    public Task<ReleaseDecisionExperimentVm> CreateAsync(ReleaseDecisionExperiment experiment)
    {
        var vm = ToVm(experiment.Id == Guid.Empty ? ExperimentId : experiment.Id, experiment.FeatBitEnvId ?? TestWorkspace.Id);
        vm.Name = experiment.Name;
        vm.Description = experiment.Description;
        vm.FlagKey = experiment.FlagKey;
        vm.FeatBitProjectKey = experiment.FeatBitProjectKey;

        return Task.FromResult(vm);
    }

    public Task<ReleaseDecisionExperimentDetailVm> GetAsync(Guid envId, Guid id)
    {
        return Task.FromResult(ToDetailVm(id, envId));
    }

    public Task<Guid> GetEnvIdAsync(Guid id)
    {
        return Task.FromResult(TestWorkspace.Id);
    }

    public Task DeleteAsync(Guid envId, Guid id)
    {
        return Task.CompletedTask;
    }

    public Task<ReleaseDecisionExperimentDetailVm> UpdateAsync(Guid envId, Guid id, ReleaseDecisionExperimentUpdate update)
    {
        var vm = ToDetailVm(id, envId);
        vm.Goal = update.Goal ?? vm.Goal;
        vm.Intent = update.Intent ?? vm.Intent;
        vm.Hypothesis = update.Hypothesis ?? vm.Hypothesis;

        return Task.FromResult(vm);
    }

    public Task<ReleaseDecisionExperimentDetailVm> UpdateStageAsync(Guid envId, Guid id, string stage)
    {
        var vm = ToDetailVm(id, envId);
        vm.Stage = stage;

        return Task.FromResult(vm);
    }

    public Task<ReleaseDecisionExperimentDetailVm> UpdateMetricsAsync(Guid envId, Guid id, ReleaseDecisionMetricsUpdate update)
    {
        var vm = ToDetailVm(id, envId);
        vm.PrimaryMetric = update.MetricName;
        vm.Guardrails = update.Guardrails;

        return Task.FromResult(vm);
    }

    public Task<ReleaseDecisionExperimentDetailVm> CreateRunAsync(Guid envId, Guid id)
    {
        return Task.FromResult(ToDetailVm(id, envId));
    }

    public Task<ReleaseDecisionExperimentDetailVm> DeleteRunAsync(Guid envId, Guid id, Guid runId)
    {
        var vm = ToDetailVm(id, envId);
        vm.ExperimentRuns = [];

        return Task.FromResult(vm);
    }

    public Task<ReleaseDecisionExperimentDetailVm> UpdateRunAsync(
        Guid envId,
        Guid id,
        Guid runId,
        ReleaseDecisionExperimentRunUpdate update)
    {
        var vm = ToDetailVm(id, envId);
        vm.ExperimentRuns.First().Status = update.Status ?? "draft";
        vm.ExperimentRuns.First().Decision = update.Decision;

        return Task.FromResult(vm);
    }

    public Task<ReleaseDecisionExperimentDetailVm> UpdateRunAudienceAsync(
        Guid envId,
        Guid id,
        Guid runId,
        ReleaseDecisionExperimentRunAudienceUpdate update)
    {
        var vm = ToDetailVm(id, envId);
        vm.ExperimentRuns.First().TrafficPercent = update.TrafficPercent;
        vm.ExperimentRuns.First().TrafficOffset = update.TrafficOffset;
        vm.ExperimentRuns.First().LayerId = update.LayerId;
        vm.ExperimentRuns.First().AudienceFilters = update.AudienceFilters;
        vm.ExperimentRuns.First().Method = update.Method;

        return Task.FromResult(vm);
    }

    public Task<ReleaseDecisionExperimentDetailVm> UpdateRunObservationWindowAsync(
        Guid envId,
        Guid id,
        Guid runId,
        ReleaseDecisionExperimentRunObservationWindowUpdate update)
    {
        var vm = ToDetailVm(id, envId);
        vm.ExperimentRuns.First().ObservationStart = update.ObservationStart;
        vm.ExperimentRuns.First().ObservationEnd = update.ObservationEnd;

        return Task.FromResult(vm);
    }

    public Task<ReleaseDecisionExperimentDetailVm> AnalyzeRunAsync(
        Guid envId,
        Guid id,
        Guid runId,
        ReleaseDecisionExperimentRunAnalyzeRequest request)
    {
        var vm = ToDetailVm(id, envId);
        vm.ExperimentRuns.First().Status = "analyzed";
        vm.ExperimentRuns.First().AnalysisResult = request.ForceFresh
            ? "{\"forceFresh\":true}"
            : "{\"forceFresh\":false}";

        return Task.FromResult(vm);
    }

    public Task<PagedResult<ReleaseDecisionExperimentVm>> GetListAsync(
        Guid envId,
        ReleaseDecisionExperimentFilter filter)
    {
        IReadOnlyList<ReleaseDecisionExperimentVm> items = [ToVm(ExperimentId, envId)];
        return Task.FromResult(new PagedResult<ReleaseDecisionExperimentVm>(items.Count, items));
    }

    private static ReleaseDecisionExperimentVm ToVm(Guid id, Guid envId)
    {
        return new ReleaseDecisionExperimentVm
        {
            Id = id,
            Name = "Checkout onboarding",
            Description = "Improve activation from checkout",
            Stage = "hypothesis",
            FlagKey = "checkout-onboarding",
            FeatBitProjectKey = "featbit-web",
            FeatBitEnvId = envId,
            RunCount = 1,
            RunMethodSummary = "bayesian",
            CreatedAt = CreatedAt,
            UpdatedAt = UpdatedAt
        };
    }

    private static ReleaseDecisionExperimentDetailVm ToDetailVm(Guid id, Guid envId)
    {
        return new ReleaseDecisionExperimentDetailVm
        {
            Id = id,
            Name = "Checkout onboarding",
            Description = "Improve activation from checkout",
            Stage = "hypothesis",
            FlagKey = "checkout-onboarding",
            FeatBitProjectKey = "featbit-web",
            FeatBitEnvId = envId,
            RunCount = 1,
            RunMethodSummary = "bayesian",
            CreatedAt = CreatedAt,
            UpdatedAt = UpdatedAt,
            Goal = "Increase activated checkout users",
            Intent = "Learn whether guided onboarding improves activation",
            Hypothesis = "Guided onboarding increases checkout activation",
            Change = "Show guided onboarding",
            PrimaryMetric = "activation",
            Guardrails = "[]",
            SandboxStatus = "idle",
            EntryMode = "guided",
            ExperimentRuns =
            [
                new ReleaseDecisionExperimentRunVm
                {
                    Id = RunId,
                    ExperimentId = id,
                    Slug = "run-1",
                    Status = "draft",
                    Method = "bayesian",
                    PrimaryMetricEvent = "checkout_activated",
                    PrimaryMetricAgg = "once",
                    PrimaryMetricType = "binary",
                    ControlVariant = "control",
                    TreatmentVariant = "treatment",
                    TrafficPercent = 100,
                    TrafficOffset = 0,
                    DataSourceMode = "featbit-managed",
                    CreatedAt = CreatedAt,
                    UpdatedAt = UpdatedAt
                }
            ],
            Activities =
            [
                new ReleaseDecisionActivityVm
                {
                    Id = new Guid("30000000-0000-0000-0000-000000000001"),
                    Type = "updated",
                    Title = "Experiment updated",
                    Detail = "Test activity",
                    CreatedAt = UpdatedAt
                }
            ]
        };
    }
}
