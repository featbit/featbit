using Application.Bases.Exceptions;
using Domain.ReleaseMetricSourceConnections;

namespace Application.ReleaseMetricSourceConnections;

public class GetReleaseMetricSourceConnection : IRequest<ReleaseMetricSourceConnectionVm>
{
    public Guid OrgId { get; set; }
    public Guid EnvId { get; set; }
    public Guid Id { get; set; }
}

public class GetReleaseMetricSourceConnectionHandler(
    IReleaseMetricSourceConnectionService service,
    ReleaseMetricSourceConnectionAccessGuard accessGuard)
    : IRequestHandler<GetReleaseMetricSourceConnection, ReleaseMetricSourceConnectionVm>
{
    public async Task<ReleaseMetricSourceConnectionVm> Handle(GetReleaseMetricSourceConnection request, CancellationToken cancellationToken)
    {
        await accessGuard.GetEnvironmentAsync(request.OrgId, request.EnvId);
        var connection = await service.FindAsync(request.EnvId, request.Id, cancellationToken)
            ?? throw new EntityNotFoundException(nameof(ReleaseMetricSourceConnection), request.Id.ToString());
        return ReleaseMetricSourceConnectionVm.From(connection);
    }
}
