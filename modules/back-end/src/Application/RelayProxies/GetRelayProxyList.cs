using Domain.RelayProxies;
using Application.Bases.Models;

namespace Application.RelayProxies;

public class GetRelayProxyList : IRequest<PagedResult<RelayProxy>>
{
    public Guid OrganizationId { get; set; }

    public RelayProxyFilter Filter { get; set; }
}

public class GetRelayProxyListHandler : IRequestHandler<GetRelayProxyList, PagedResult<RelayProxy>>
{
    private readonly IRelayProxyService _service;

    public GetRelayProxyListHandler(IRelayProxyService service)
    {
        _service = service;
    }

    public async Task<PagedResult<RelayProxy>> Handle(GetRelayProxyList request, CancellationToken cancellationToken)
    {
        var relayProxies =
            await _service.GetListAsync(request.OrganizationId, request.Filter);

        foreach (var relayProxy in relayProxies.Items)
        {
            relayProxy.Key = relayProxy.Key[..15] + "**************";
        }

        return relayProxies;
    }
}