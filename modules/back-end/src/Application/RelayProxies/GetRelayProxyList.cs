using Application.Bases.Models;

namespace Application.RelayProxies;

public class GetRelayProxyList : IRequest<PagedResult<RelayProxyVm>>
{
    public Guid OrganizationId { get; set; }

    public RelayProxyFilter Filter { get; set; }
}

public class GetRelayProxyListHandler(IRelayProxyService service, IEnvironmentService envService, IMapper mapper)
    : IRequestHandler<GetRelayProxyList, PagedResult<RelayProxyVm>>
{
    public async Task<PagedResult<RelayProxyVm>> Handle(GetRelayProxyList request, CancellationToken cancellationToken)
    {
        var rps =
            await service.GetListAsync(request.OrganizationId, request.Filter);

        var rpVms = mapper.Map<PagedResult<RelayProxyVm>>(rps);
        foreach (var rp in rpVms.Items)
        {
            rp.Serves = await envService.GetServesAsync(rp.Scopes);
        }

        return rpVms;
    }
}