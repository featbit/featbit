namespace Application.EndUsers;

public class GetEndUserSegments : IRequest<IEnumerable<EndUserSegment>>
{
    public Guid Id { get; set; }
}

public class GetEndUserSegmentsHandler : IRequestHandler<GetEndUserSegments, IEnumerable<EndUserSegment>>
{
    private readonly IEndUserService _endUserService;
    private readonly ISegmentService _segmentService;

    public GetEndUserSegmentsHandler(IEndUserService endUserService, ISegmentService segmentService)
    {
        _endUserService = endUserService;
        _segmentService = segmentService;
    }

    public async Task<IEnumerable<EndUserSegment>> Handle(GetEndUserSegments request, CancellationToken cancellationToken)
    {
        var endUser = await _endUserService.GetAsync(request.Id);
        var segments = await _segmentService.FindManyAsync(x => !x.IsArchived);

        var result = segments
            .Where(x => x.IsMatch(endUser))
            .Select(x => new EndUserSegment(x));

        return result;
    }
}