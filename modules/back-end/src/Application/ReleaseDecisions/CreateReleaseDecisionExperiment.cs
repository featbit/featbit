using Application.Bases;
using Domain.ReleaseDecisions;

namespace Application.ReleaseDecisions;

public class CreateReleaseDecisionExperiment : IRequest<ReleaseDecisionExperimentVm>
{
    public Guid EnvId { get; set; }

    public string Name { get; set; }

    public string Description { get; set; }

    public string FlagKey { get; set; }

    public string FeatBitProjectKey { get; set; }
}

public class CreateReleaseDecisionExperimentValidator : AbstractValidator<CreateReleaseDecisionExperiment>
{
    public CreateReleaseDecisionExperimentValidator()
    {
        RuleFor(x => x.Name)
            .Must(name => !string.IsNullOrWhiteSpace(name)).WithErrorCode(ErrorCodes.Required("name"));
    }
}

public class CreateReleaseDecisionExperimentHandler(
    IReleaseDecisionExperimentService service)
    : IRequestHandler<CreateReleaseDecisionExperiment, ReleaseDecisionExperimentVm>
{
    public async Task<ReleaseDecisionExperimentVm> Handle(
        CreateReleaseDecisionExperiment request,
        CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var experiment = new ReleaseDecisionExperiment
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            FlagKey = string.IsNullOrWhiteSpace(request.FlagKey) ? null : request.FlagKey.Trim(),
            FeatBitProjectKey = string.IsNullOrWhiteSpace(request.FeatBitProjectKey) ? null : request.FeatBitProjectKey.Trim(),
            FeatBitEnvId = request.EnvId,
            Stage = "hypothesis",
            SandboxStatus = "idle",
            CreatedAt = now,
            UpdatedAt = now
        };

        return await service.CreateAsync(experiment);
    }
}
