using Application.Bases;

namespace Application.ReleaseDecisions;

public class ReleaseDecisionExperimentUpdate
{
    public string Name { get; set; }

    public string Description { get; set; }

    public string Stage { get; set; }

    public string FlagKey { get; set; }

    public string Hypothesis { get; set; }

    public string AccessToken { get; set; }

    public string Change { get; set; }

    public string Constraints { get; set; }

    public string EnvSecret { get; set; }

    public string FlagServerUrl { get; set; }

    public string Goal { get; set; }

    public string Guardrails { get; set; }

    public string Intent { get; set; }

    public string LastAction { get; set; }

    public string LastLearning { get; set; }

    public string OpenQuestions { get; set; }

    public string PrimaryMetric { get; set; }

    public string SandboxId { get; set; }

    public string Variants { get; set; }

    public string ConflictAnalysis { get; set; }

    public string EntryMode { get; set; }
}

public class UpdateReleaseDecisionExperiment : IRequest<ReleaseDecisionExperimentDetailVm>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }

    public ReleaseDecisionExperimentUpdate Update { get; set; }
}

public class UpdateReleaseDecisionExperimentValidator : AbstractValidator<UpdateReleaseDecisionExperiment>
{
    public UpdateReleaseDecisionExperimentValidator()
    {
        RuleFor(x => x.Update)
            .NotNull().WithErrorCode(ErrorCodes.Required("update"));

        When(x => x.Update != null, () =>
        {
            RuleFor(x => x.Update.PrimaryMetric)
                .Must(string.IsNullOrWhiteSpace)
                .WithErrorCode(ErrorCodes.Invalid("primaryMetric"))
                .WithMessage(
                    "Do not write primaryMetric through update_experiment. Use update_metrics with metricName, metricEvent, metricType, and metricAgg.");

            RuleFor(x => x.Update.Guardrails)
                .Must(string.IsNullOrWhiteSpace)
                .WithErrorCode(ErrorCodes.Invalid("guardrails"))
                .WithMessage(
                    "Do not write guardrails through update_experiment. Use update_metrics with structured guardrail definitions.");
        });
    }
}

public class UpdateReleaseDecisionExperimentHandler(
    IReleaseDecisionExperimentService service)
    : IRequestHandler<UpdateReleaseDecisionExperiment, ReleaseDecisionExperimentDetailVm>
{
    public async Task<ReleaseDecisionExperimentDetailVm> Handle(
        UpdateReleaseDecisionExperiment request,
        CancellationToken cancellationToken)
    {
        return await service.UpdateAsync(request.EnvId, request.Id, request.Update);
    }
}

public class UpdateReleaseDecisionExperimentStage : IRequest<ReleaseDecisionExperimentDetailVm>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }

    public string Stage { get; set; }
}

public class UpdateReleaseDecisionExperimentStageHandler(
    IReleaseDecisionExperimentService service)
    : IRequestHandler<UpdateReleaseDecisionExperimentStage, ReleaseDecisionExperimentDetailVm>
{
    public async Task<ReleaseDecisionExperimentDetailVm> Handle(
        UpdateReleaseDecisionExperimentStage request,
        CancellationToken cancellationToken)
    {
        return await service.UpdateStageAsync(request.EnvId, request.Id, request.Stage);
    }
}
