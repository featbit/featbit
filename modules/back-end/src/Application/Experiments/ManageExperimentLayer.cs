using Application.Bases;
using Application.Bases.Models;

namespace Application.Experiments;

public class ExperimentLayerVm
{
    public Guid Id { get; set; }

    public Guid FeatBitEnvId { get; set; }

    public string Name { get; set; }

    public string Key { get; set; }

    public string Description { get; set; }

    public string AssignmentUnitSelector { get; set; }

    public string Status { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }
}

public class ExperimentLayerFilter : PagedRequest
{
    public string Name { get; set; }

    public string Key { get; set; }

    public string Status { get; set; }
}

public class ExperimentLayerUpdate
{
    public string Name { get; set; }

    public string Key { get; set; }

    public string Description { get; set; }

    public string AssignmentUnitSelector { get; set; }

    public string Status { get; set; }
}

public class QueryExperimentLayers : IRequest<PagedResult<ExperimentLayerVm>>
{
    public Guid EnvId { get; set; }

    public ExperimentLayerFilter Filter { get; set; }
}

public class CreateExperimentLayer : IRequest<ExperimentLayerVm>
{
    public Guid EnvId { get; set; }

    public ExperimentLayerUpdate Update { get; set; }
}

public class UpdateExperimentLayer : IRequest<ExperimentLayerVm>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }

    public ExperimentLayerUpdate Update { get; set; }
}

public class DeleteExperimentLayer : IRequest<bool>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }
}

public class ExperimentLayerUpdateValidator : AbstractValidator<ExperimentLayerUpdate>
{
    public ExperimentLayerUpdateValidator()
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

        RuleFor(x => x.Status)
            .Must(x => string.IsNullOrWhiteSpace(x) || x is "active" or "archived")
            .WithErrorCode(ErrorCodes.Invalid("status"));
    }
}

public class QueryExperimentLayersHandler(IExperimentLayerService service)
    : IRequestHandler<QueryExperimentLayers, PagedResult<ExperimentLayerVm>>
{
    public async Task<PagedResult<ExperimentLayerVm>> Handle(
        QueryExperimentLayers request,
        CancellationToken cancellationToken)
    {
        return await service.GetListAsync(request.EnvId, request.Filter);
    }
}

public class CreateExperimentLayerHandler(IExperimentLayerService service)
    : IRequestHandler<CreateExperimentLayer, ExperimentLayerVm>
{
    public async Task<ExperimentLayerVm> Handle(
        CreateExperimentLayer request,
        CancellationToken cancellationToken)
    {
        return await service.CreateAsync(request.EnvId, request.Update);
    }
}

public class UpdateExperimentLayerHandler(IExperimentLayerService service)
    : IRequestHandler<UpdateExperimentLayer, ExperimentLayerVm>
{
    public async Task<ExperimentLayerVm> Handle(
        UpdateExperimentLayer request,
        CancellationToken cancellationToken)
    {
        return await service.UpdateAsync(request.EnvId, request.Id, request.Update);
    }
}

public class DeleteExperimentLayerHandler(IExperimentLayerService service)
    : IRequestHandler<DeleteExperimentLayer, bool>
{
    public async Task<bool> Handle(DeleteExperimentLayer request, CancellationToken cancellationToken)
    {
        await service.ArchiveAsync(request.EnvId, request.Id);
        return true;
    }
}
