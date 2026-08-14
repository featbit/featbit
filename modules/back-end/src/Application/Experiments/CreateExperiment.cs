using Application.Bases;
using Domain.Experiments;

namespace Application.Experiments;

public class CreateExperiment : IRequest<ExperimentVm>
{
    public Guid EnvId { get; set; }

    public string Name { get; set; }

    public string Description { get; set; }

    public string FlagKey { get; set; }

    public string FeatBitProjectKey { get; set; }
}

public class CreateExperimentValidator : AbstractValidator<CreateExperiment>
{
    public CreateExperimentValidator()
    {
        RuleFor(x => x.Name)
            .Must(name => !string.IsNullOrWhiteSpace(name)).WithErrorCode(ErrorCodes.Required("name"));
    }
}

public class CreateExperimentHandler(
    IExperimentService service)
    : IRequestHandler<CreateExperiment, ExperimentVm>
{
    public async Task<ExperimentVm> Handle(
        CreateExperiment request,
        CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var experiment = new Experiment
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
