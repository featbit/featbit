using Application.Bases;

namespace Application.Experiments.ExperimentLayers;

public class UpdateExperimentLayerRequest
{
    public string Name { get; set; }

    public string Description { get; set; }

    public string AssignmentUnitSelector { get; set; }
}

public class UpdateExperimentLayerRequestValidator : AbstractValidator<UpdateExperimentLayerRequest>
{
    public UpdateExperimentLayerRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("name"))
            .MaximumLength(256).WithErrorCode(ErrorCodes.Invalid("name"));

        RuleFor(x => x.AssignmentUnitSelector)
            .MaximumLength(256).WithErrorCode(ErrorCodes.Invalid("assignmentUnitSelector"));
    }
}
