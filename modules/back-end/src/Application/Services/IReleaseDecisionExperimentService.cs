using Application.Bases.Models;
using Application.ReleaseDecisions;
using Domain.ReleaseDecisions;

namespace Application.Services;

public interface IReleaseDecisionExperimentService
{
    Task<ReleaseDecisionExperimentVm> CreateAsync(ReleaseDecisionExperiment experiment);

    Task<ReleaseDecisionExperimentDetailVm> GetAsync(Guid envId, Guid id);

    Task<Guid> GetEnvIdAsync(Guid id);

    Task DeleteAsync(Guid envId, Guid id);

    Task<ReleaseDecisionExperimentDetailVm> UpdateAsync(
        Guid envId,
        Guid id,
        ReleaseDecisionExperimentUpdate update);

    Task<ReleaseDecisionExperimentDetailVm> UpdateStageAsync(
        Guid envId,
        Guid id,
        string stage);

    Task<ReleaseDecisionExperimentDetailVm> UpdateMetricsAsync(
        Guid envId,
        Guid id,
        ReleaseDecisionMetricsUpdate update);

    Task<ReleaseDecisionExperimentDetailVm> CreateRunAsync(Guid envId, Guid id);

    Task<ReleaseDecisionExperimentDetailVm> DeleteRunAsync(Guid envId, Guid id, Guid runId);

    Task<ReleaseDecisionExperimentDetailVm> UpdateRunAsync(
        Guid envId,
        Guid id,
        Guid runId,
        ReleaseDecisionExperimentRunUpdate update);

    Task<ReleaseDecisionExperimentDetailVm> UpdateRunAudienceAsync(
        Guid envId,
        Guid id,
        Guid runId,
        ReleaseDecisionExperimentRunAudienceUpdate update);

    Task<ReleaseDecisionExperimentDetailVm> UpdateRunObservationWindowAsync(
        Guid envId,
        Guid id,
        Guid runId,
        ReleaseDecisionExperimentRunObservationWindowUpdate update);

    Task<ReleaseDecisionExperimentDetailVm> AnalyzeRunAsync(
        Guid envId,
        Guid id,
        Guid runId,
        ReleaseDecisionExperimentRunAnalyzeRequest request);

    Task<PagedResult<ReleaseDecisionExperimentVm>> GetListAsync(
        Guid envId,
        ReleaseDecisionExperimentFilter filter);
}
