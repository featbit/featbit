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
    private readonly ISegmentAppService _appService;

    public GetFlagReferencesHandler(ISegmentService service, ISegmentAppService appService)
    {
        _service = service;
        _appService = appService;
    }

    public async Task<IEnumerable<FlagReference>> Handle(GetFlagReferences request, CancellationToken cancellationToken)
    {
        var references = new List<FlagReference>();

        var segment = await _service.GetAsync(request.Id);
        var envIds = await _appService.GetEnvironmentIdsAsync(segment);
        foreach (var envId in envIds)
        {
            var envReferences = await _service.GetFlagReferencesAsync(envId, request.Id);
            references.AddRange(envReferences);
        }

        return references;
    }
}