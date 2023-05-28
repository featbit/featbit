using Application.Bases.Models;

namespace Application.RelayProxies;

public class GetRelayProxyList : IRequest<PagedResult<RelayProxyVm>>
{
    public Guid OrganizationId { get; set; }

    public RelayProxyFilter Filter { get; set; }
}

public class GetRelayProxyListHandler : IRequestHandler<GetRelayProxyList, PagedResult<RelayProxyVm>>
{
    private readonly IRelayProxyService _service;
    private readonly IMapper _mapper;

    public GetRelayProxyListHandler(IRelayProxyService service, IMapper mapper)
    {
        _service = service;
        _mapper = mapper;
    }

    public async Task<PagedResult<RelayProxyVm>> Handle(GetRelayProxyList request, CancellationToken cancellationToken)
    {
        var relayProxies =
            await _service.GetListAsync(request.OrganizationId, request.Filter);
        
        var replayProxyVms = _mapper.Map<PagedResult<RelayProxyVm>>(relayProxies);
        
        foreach (var relayProxy in replayProxyVms.Items)
        {
            relayProxy.Key = relayProxy.Key[..15] + "**************";
        }

        return replayProxyVms;
    }
}