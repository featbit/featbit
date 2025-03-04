using Domain.Segments;

namespace Application.Segments;

public class GetFlagReferences : IRequest<IEnumerable<FlagReference>>
{
    public Guid EnvId { get; set; }

    public Guid Id { get; set; }
}

public class GetFlagReferencesHandler(ISegmentService service)
    : IRequestHandler<GetFlagReferences, IEnumerable<FlagReference>>
{
    public async Task<IEnumerable<FlagReference>> Handle(GetFlagReferences request, CancellationToken cancellationToken)
    {
        var references = new List<FlagReference>();

        var segment = await service.GetAsync(request.Id);
        var envIds = await service.GetEnvironmentIdsAsync(segment);
        foreach (var envId in envIds)
        {
            var envReferences = await service.GetFlagReferencesAsync(envId, request.Id);
            references.AddRange(envReferences);
        }

        return references;
    }
}