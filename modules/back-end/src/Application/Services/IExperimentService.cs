using Application.Bases.Models;
using Application.Experiments;
using Application.Experiments.ExperimentMetrics;
using Domain.Experiments;

namespace Application.Services;

public interface IExperimentService
{
    Task<ExperimentVm> CreateAsync(Experiment experiment);

    Task<ExperimentDetailVm> GetAsync(Guid envId, Guid id);

    Task<Guid> GetEnvIdAsync(Guid id);

    Task DeleteAsync(Guid envId, Guid id);

    Task<ExperimentDetailVm> UpdateAsync(
        Guid envId,
        Guid id,
        ExperimentUpdate update);

    Task<ExperimentDetailVm> UpdateStageAsync(
        Guid envId,
        Guid id,
        string stage);

    Task<ExperimentDetailVm> UpdateMetricsAsync(
        Guid envId,
        Guid id,
        ExperimentMetricsUpdate update);

    Task<ExperimentDetailVm> CreateRunAsync(Guid envId, Guid id, ExperimentRunCreate setup);

    Task<ExperimentDetailVm> DeleteRunAsync(Guid envId, Guid id, Guid runId);

    Task<ExperimentDetailVm> UpdateRunAsync(
        Guid envId,
        Guid id,
        Guid runId,
        ExperimentRunUpdate update);

    Task<ExperimentDetailVm> UpdateRunAudienceAsync(
        Guid envId,
        Guid id,
        Guid runId,
        ExperimentRunAudienceUpdate update);

    Task<ExperimentDetailVm> UpdateRunObservationWindowAsync(
        Guid envId,
        Guid id,
        Guid runId,
        ExperimentRunObservationWindowUpdate update);

    Task<ExperimentDetailVm> AnalyzeRunAsync(
        Guid envId,
        Guid id,
        Guid runId,
        ExperimentRunAnalyzeRequest request);

    Task<IReadOnlyCollection<ExperimentRunForLayer>> GetExperimentRunsByLayersAsync(
        Guid envId,
        IReadOnlyCollection<ExperimentLayer> layers);

    Task<IReadOnlyCollection<ExperimentWithRuns>> GetExperimentsWithRunsAsync(
        Guid envId,
        string nameSearchText = null);

    /// <summary>
    /// Experiments bound to the flag that have at least one run whose observation window has not ended at
    /// <paramref name="now"/>, including runs scheduled to start later.
    /// </summary>
    Task<IReadOnlyList<ExperimentRef>> GetRunningForFlagAsync(Guid envId, Guid flagId, DateTime now);

    Task<PagedResult<ExperimentVm>> GetListAsync(
        Guid envId,
        ExperimentFilter filter);
}
