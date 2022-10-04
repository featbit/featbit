using Domain.EndUsers;

namespace Application.EndUsers;

public class GetEndUserProperties : IRequest<IEnumerable<EndUserProperty>>
{
    public Guid EnvId { get; set; }
}

public class GetEndUserPropertiesHandler : IRequestHandler<GetEndUserProperties, IEnumerable<EndUserProperty>>
{
    private readonly IEndUserService _service;

    public GetEndUserPropertiesHandler(IEndUserService service)
    {
        _service = service;
    }
    
    public async Task<IEnumerable<EndUserProperty>> Handle(GetEndUserProperties request, CancellationToken cancellationToken)
    {
        return await _service.GetPropertiesAsync(request.EnvId);
    }
}