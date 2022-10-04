using Domain.EndUsers;

namespace Application.EndUsers;

public class GetEndUserByKeyIds : IRequest<IEnumerable<EndUser>>
{
    public Guid EnvId { get; set; }

    public string[] KeyIds { get; set; }
}

public class GetEndUserByKeyIdsHandler : IRequestHandler<GetEndUserByKeyIds, IEnumerable<EndUser>>
{
    private readonly IEndUserService _service;

    public GetEndUserByKeyIdsHandler(IEndUserService service)
    {
        _service = service;
    }
    
    public async Task<IEnumerable<EndUser>> Handle(GetEndUserByKeyIds request, CancellationToken cancellationToken)
    {
        return await _service.FindAsync(x => x.EnvId == request.EnvId && request.KeyIds.Contains(x.KeyId));
    }
}