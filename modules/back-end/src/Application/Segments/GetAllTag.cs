namespace Application.Segments;

public class GetAllTag : IRequest<ICollection<string>>
{
    public Guid EnvId { get; set; }
}

public class GetAllTagHandler(ISegmentService service) : IRequestHandler<GetAllTag, ICollection<string>>
{
    public async Task<ICollection<string>> Handle(GetAllTag request, CancellationToken cancellationToken)
        => await service.GetAllTagsAsync(request.EnvId);
}