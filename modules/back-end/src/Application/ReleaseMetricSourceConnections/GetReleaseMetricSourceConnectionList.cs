namespace Application.ReleaseMetricSourceConnections;

public class GetReleaseMetricSourceConnectionList : IRequest<IEnumerable<ReleaseMetricSourceConnectionVm>>
{
    public Guid EnvId { get; set; }
}

public class GetReleaseMetricSourceConnectionListHandler(IReleaseMetricSourceConnectionService service)
    : IRequestHandler<GetReleaseMetricSourceConnectionList, IEnumerable<ReleaseMetricSourceConnectionVm>>
{
    public async Task<IEnumerable<ReleaseMetricSourceConnectionVm>> Handle(GetReleaseMetricSourceConnectionList request, CancellationToken cancellationToken)
    {
        var connections = await service.GetListAsync(request.EnvId, cancellationToken);
        return connections.Select(ReleaseMetricSourceConnectionVm.From);
    }
}
