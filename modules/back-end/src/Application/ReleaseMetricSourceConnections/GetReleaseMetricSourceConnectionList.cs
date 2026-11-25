namespace Application.ReleaseMetricSourceConnections;

public class GetReleaseMetricSourceConnectionList : IRequest<IEnumerable<ReleaseMetricSourceConnectionVm>>
{
    public Guid OrgId { get; set; }
    public Guid EnvId { get; set; }
}

public class GetReleaseMetricSourceConnectionListHandler(
    IReleaseMetricSourceConnectionService service,
    ReleaseMetricSourceConnectionAccessGuard accessGuard)
    : IRequestHandler<GetReleaseMetricSourceConnectionList, IEnumerable<ReleaseMetricSourceConnectionVm>>
{
    public async Task<IEnumerable<ReleaseMetricSourceConnectionVm>> Handle(GetReleaseMetricSourceConnectionList request, CancellationToken cancellationToken)
    {
        await accessGuard.GetEnvironmentAsync(request.OrgId, request.EnvId);
        var connections = await service.GetListAsync(request.EnvId, cancellationToken);
        return connections.Select(ReleaseMetricSourceConnectionVm.From);
    }
}
