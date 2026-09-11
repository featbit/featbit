using Application.Bases;

namespace Application.Experiments.ExperimentLayers;

public class CreateExperimentLayerRequest
{
    public string Name { get; set; }

    public string Key { get; set; }

    public string Description { get; set; }

    public string AssignmentUnitSelector { get; set; }
}

public class CreateExperimentLayerRequestValidator : AbstractValidator<CreateExperimentLayerRequest>
{
    public CreateExperimentLayerRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("name"))
            .MaximumLength(256).WithErrorCode(ErrorCodes.Invalid("name"));

        RuleFor(x => x.Key)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("key"))
            .MaximumLength(128).WithErrorCode(ErrorCodes.Invalid("key"))
            .Matches("^[a-zA-Z0-9][a-zA-Z0-9._:-]*$")
            .WithErrorCode(ErrorCodes.Invalid("key"));

        RuleFor(x => x.AssignmentUnitSelector)
            .MaximumLength(256).WithErrorCode(ErrorCodes.Invalid("assignmentUnitSelector"));
    }
}
