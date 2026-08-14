using Application.Bases.Models;
using Application.Experiments;
using Application.Services;
using Domain.Experiments;

namespace Application.IntegrationTests.Stubs;

public class TestExperimentService : IExperimentService
{
    public static readonly Guid ExperimentId = new("10000000-0000-0000-0000-000000000001");
    public static readonly Guid RunId = new("20000000-0000-0000-0000-000000000001");
    private static readonly DateTime CreatedAt = new(2026, 6, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime UpdatedAt = new(2026, 6, 2, 0, 0, 0, DateTimeKind.Utc);

    public Task<ExperimentVm> CreateAsync(Experiment experiment)
    {
        var vm = ToVm(experiment.Id == Guid.Empty ? ExperimentId : experiment.Id, experiment.FeatBitEnvId ?? TestWorkspace.Id);
        vm.Name = experiment.Name;
        vm.Description = experiment.Description;
        vm.FlagKey = experiment.FlagKey;
        vm.FeatBitProjectKey = experiment.FeatBitProjectKey;

        return Task.FromResult(vm);
    }

    public Task<ExperimentDetailVm> GetAsync(Guid envId, Guid id)
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

    public Task<ExperimentDetailVm> UpdateAsync(Guid envId, Guid id, ExperimentUpdate update)
    {
        var vm = ToDetailVm(id, envId);
        vm.Goal = update.Goal ?? vm.Goal;
        vm.Intent = update.Intent ?? vm.Intent;
        vm.Hypothesis = update.Hypothesis ?? vm.Hypothesis;

        return Task.FromResult(vm);
    }

    public Task<ExperimentDetailVm> UpdateStageAsync(Guid envId, Guid id, string stage)
    {
        var vm = ToDetailVm(id, envId);
        vm.Stage = stage;

        return Task.FromResult(vm);
    }

    public Task<ExperimentDetailVm> UpdateMetricsAsync(Guid envId, Guid id, ExperimentMetricsUpdate update)
    {
        var vm = ToDetailVm(id, envId);
        vm.PrimaryMetric = update.MetricName;
        vm.Guardrails = update.Guardrails;

        return Task.FromResult(vm);
    }

    public Task<ExperimentDetailVm> CreateRunAsync(Guid envId, Guid id)
    {
        return Task.FromResult(ToDetailVm(id, envId));
    }

    public Task<ExperimentDetailVm> DeleteRunAsync(Guid envId, Guid id, Guid runId)
    {
        var vm = ToDetailVm(id, envId);
        vm.ExperimentRuns = [];

        return Task.FromResult(vm);
    }

    public Task<ExperimentDetailVm> UpdateRunAsync(
        Guid envId,
        Guid id,
        Guid runId,
        ExperimentRunUpdate update)
    {
        var vm = ToDetailVm(id, envId);
        vm.ExperimentRuns.First().Status = update.Status ?? "draft";
        vm.ExperimentRuns.First().Decision = update.Decision;

        return Task.FromResult(vm);
    }

    public Task<ExperimentDetailVm> UpdateRunAudienceAsync(
        Guid envId,
        Guid id,
        Guid runId,
        ExperimentRunAudienceUpdate update)
    {
        var vm = ToDetailVm(id, envId);
        vm.ExperimentRuns.First().TrafficPercent = update.TrafficPercent;
        vm.ExperimentRuns.First().TrafficOffset = update.TrafficOffset;
        vm.ExperimentRuns.First().LayerId = update.LayerId;
        vm.ExperimentRuns.First().LayerKey = update.LayerKey;
        vm.ExperimentRuns.First().AssignmentUnitSelector = update.AssignmentUnitSelector;
        vm.ExperimentRuns.First().LayerTrafficPercent = update.LayerTrafficPercent;
        vm.ExperimentRuns.First().AnalysisSamplingPlan = update.AnalysisSamplingPlan;
        vm.ExperimentRuns.First().AudienceFilters = update.AudienceFilters;
        vm.ExperimentRuns.First().Method = update.Method;
        vm.ExperimentRuns.First().ControlVariant = update.ControlVariant;
        vm.ExperimentRuns.First().TreatmentVariant = update.TreatmentVariant;

        return Task.FromResult(vm);
    }

    public Task<ExperimentDetailVm> UpdateRunObservationWindowAsync(
        Guid envId,
        Guid id,
        Guid runId,
        ExperimentRunObservationWindowUpdate update)
    {
        var vm = ToDetailVm(id, envId);
        vm.ExperimentRuns.First().ObservationStart = update.ObservationStart;
        vm.ExperimentRuns.First().ObservationEnd = update.ObservationEnd;

        return Task.FromResult(vm);
    }

    public Task<ExperimentDetailVm> AnalyzeRunAsync(
        Guid envId,
        Guid id,
        Guid runId,
        ExperimentRunAnalyzeRequest request)
    {
        var vm = ToDetailVm(id, envId);
        vm.ExperimentRuns.First().Status = "analyzed";
        vm.ExperimentRuns.First().AnalysisResult = request.ForceFresh
            ? "{\"forceFresh\":true}"
            : "{\"forceFresh\":false}";

        return Task.FromResult(vm);
    }

    public Task<PagedResult<ExperimentVm>> GetListAsync(
        Guid envId,
        ExperimentFilter filter)
    {
        IReadOnlyList<ExperimentVm> items = [ToVm(ExperimentId, envId)];
        return Task.FromResult(new PagedResult<ExperimentVm>(items.Count, items));
    }

    private static ExperimentVm ToVm(Guid id, Guid envId)
    {
        return new ExperimentVm
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

    private static ExperimentDetailVm ToDetailVm(Guid id, Guid envId)
    {
        return new ExperimentDetailVm
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
                new ExperimentRunVm
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
                    LayerKey = null,
                    AssignmentUnitSelector = "user.keyId",
                    LayerTrafficPercent = 100,
                    AnalysisSamplingPlan = """[{"variation":"control","role":"control","includeRate":100},{"variation":"treatment","role":"treatment","includeRate":100}]""",
                    DataSourceMode = "featbit-managed",
                    CreatedAt = CreatedAt,
                    UpdatedAt = UpdatedAt
                }
            ],
            Activities =
            [
                new ExperimentActivityVm
                {
                    Id = new Guid("30000000-0000-0000-0000-000000000001"),
                    Type = "updated",
                    Title = "Experiment updated",
                    Detail = "Test activity",
                    ActorId = new Guid("10000000-0000-0000-0000-000000000001"),
                    ActorName = "Test User",
                    ActorEmail = "test@example.com",
                    ActorType = "user",
                    CreatedAt = UpdatedAt
                }
            ]
        };
    }
}
