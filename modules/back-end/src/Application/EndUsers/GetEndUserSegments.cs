namespace Application.EndUsers;

public class GetEndUserSegments : IRequest<IEnumerable<EndUserSegmentVm>>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }
}

public class GetEndUserSegmentsHandler : IRequestHandler<GetEndUserSegments, IEnumerable<EndUserSegmentVm>>
{
    private readonly IEndUserService _endUserService;
    private readonly ISegmentService _segmentService;

    public GetEndUserSegmentsHandler(IEndUserService endUserService, ISegmentService segmentService)
    {
        _endUserService = endUserService;
        _segmentService = segmentService;
    }

    public async Task<IEnumerable<EndUserSegmentVm>> Handle(GetEndUserSegments request, CancellationToken cancellationToken)
    {
        var endUser = await _endUserService.GetAsync(request.Id);
        var segments = await _segmentService.FindManyAsync(x => x.EnvId == request.EnvId && !x.IsArchived);

        var result = segments
            .Where(x => x.IsMatch(endUser))
            .Select(x => new EndUserSegmentVm(x));

        return result;
    }
}