using Application.Bases;
using Application.Bases.Models;

namespace Application.ReleaseDecisions;

public class ReleaseDecisionLayerVm
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

public class ReleaseDecisionLayerFilter : PagedRequest
{
    public string Name { get; set; }

    public string Key { get; set; }

    public string Status { get; set; }
}

public class ReleaseDecisionLayerUpdate
{
    public string Name { get; set; }

    public string Key { get; set; }

    public string Description { get; set; }

    public string AssignmentUnitSelector { get; set; }

    public string Status { get; set; }
}

public class QueryReleaseDecisionLayers : IRequest<PagedResult<ReleaseDecisionLayerVm>>
{
    public Guid EnvId { get; set; }

    public ReleaseDecisionLayerFilter Filter { get; set; }
}

public class CreateReleaseDecisionLayer : IRequest<ReleaseDecisionLayerVm>
{
    public Guid EnvId { get; set; }

    public ReleaseDecisionLayerUpdate Update { get; set; }
}

public class UpdateReleaseDecisionLayer : IRequest<ReleaseDecisionLayerVm>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }

    public ReleaseDecisionLayerUpdate Update { get; set; }
}

public class DeleteReleaseDecisionLayer : IRequest<bool>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }
}

public class ReleaseDecisionLayerUpdateValidator : AbstractValidator<ReleaseDecisionLayerUpdate>
{
    public ReleaseDecisionLayerUpdateValidator()
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

public class QueryReleaseDecisionLayersHandler(IReleaseDecisionLayerService service)
    : IRequestHandler<QueryReleaseDecisionLayers, PagedResult<ReleaseDecisionLayerVm>>
{
    public async Task<PagedResult<ReleaseDecisionLayerVm>> Handle(
        QueryReleaseDecisionLayers request,
        CancellationToken cancellationToken)
    {
        return await service.GetListAsync(request.EnvId, request.Filter);
    }
}

public class CreateReleaseDecisionLayerHandler(IReleaseDecisionLayerService service)
    : IRequestHandler<CreateReleaseDecisionLayer, ReleaseDecisionLayerVm>
{
    public async Task<ReleaseDecisionLayerVm> Handle(
        CreateReleaseDecisionLayer request,
        CancellationToken cancellationToken)
    {
        return await service.CreateAsync(request.EnvId, request.Update);
    }
}

public class UpdateReleaseDecisionLayerHandler(IReleaseDecisionLayerService service)
    : IRequestHandler<UpdateReleaseDecisionLayer, ReleaseDecisionLayerVm>
{
    public async Task<ReleaseDecisionLayerVm> Handle(
        UpdateReleaseDecisionLayer request,
        CancellationToken cancellationToken)
    {
        return await service.UpdateAsync(request.EnvId, request.Id, request.Update);
    }
}

public class DeleteReleaseDecisionLayerHandler(IReleaseDecisionLayerService service)
    : IRequestHandler<DeleteReleaseDecisionLayer, bool>
{
    public async Task<bool> Handle(DeleteReleaseDecisionLayer request, CancellationToken cancellationToken)
    {
        await service.ArchiveAsync(request.EnvId, request.Id);
        return true;
    }
}
