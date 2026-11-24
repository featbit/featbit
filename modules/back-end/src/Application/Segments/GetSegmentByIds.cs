using Domain.Segments;
using Application.Bases;

namespace Application.Segments;

public class GetSegmentByIds : IRequest<IEnumerable<Segment>>
{
    public Guid OrgId { get; set; }

    public Guid EnvId { get; set; }

    public Guid[] Ids { get; set; }
}

public class GetSegmentByIdsValidator : AbstractValidator<GetSegmentByIds>
{
    public GetSegmentByIdsValidator()
    {
        RuleFor(x => x.Ids).NotEmpty().WithErrorCode(ErrorCodes.Invalid("ids"));
        RuleForEach(x => x.Ids).NotEmpty().WithErrorCode(ErrorCodes.Invalid("ids"));
    }
}

public class GetSegmentByIdsHandler(ISegmentService service, IPermissionGuard permissionGuard)
    : IRequestHandler<GetSegmentByIds, IEnumerable<Segment>>
{
    public async Task<IEnumerable<Segment>> Handle(GetSegmentByIds request, CancellationToken cancellationToken)
    {
        foreach (var id in request.Ids.Distinct())
        {
            await permissionGuard.EnsureSegmentOwnershipAsync(request.OrgId, request.EnvId, id);
        }
        return await service.FindManyAsync(x => request.Ids.Contains(x.Id));
    }
}