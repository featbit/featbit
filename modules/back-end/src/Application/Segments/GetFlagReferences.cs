using Domain.Segments;

namespace Application.Segments;

public class GetFlagReferences : IRequest<IEnumerable<FlagReference>>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }
}

public class GetFlagReferencesHandler : IRequestHandler<GetFlagReferences, IEnumerable<FlagReference>>
{
    private readonly ISegmentService _service;

    public GetFlagReferencesHandler(ISegmentService service)
    {
        _service = service;
    }

    public async Task<IEnumerable<FlagReference>> Handle(GetFlagReferences request, CancellationToken cancellationToken)
    {
        return await _service.GetFlagReferencesAsync(request.EnvId, request.Id);
    }
}