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

public class GetSegmentByIdsHandler : IRequestHandler<GetSegmentByIds, IEnumerable<Segment>>
{
    private readonly ISegmentService _service;
    private readonly SegmentAccessGuard _access;

    public GetSegmentByIdsHandler(ISegmentService service, SegmentAccessGuard access)
    {
        _service = service;
        _access = access;
    }

    public async Task<IEnumerable<Segment>> Handle(GetSegmentByIds request, CancellationToken cancellationToken)
    {
        foreach (var id in request.Ids.Distinct())
        {
            await _access.EnsureAccessibleAsync(request.OrgId, request.EnvId, id);
        }
        return await _service.FindManyAsync(x => request.Ids.Contains(x.Id));
    }
}