using Application.Bases.Exceptions;
using Domain.ReleaseMetricSourceConnections;

namespace Application.ReleaseMetricSourceConnections;

public class DeleteReleaseMetricSourceConnection : IRequest<bool>
{
    public Guid OrgId { get; set; }
    public Guid EnvId { get; set; }
    public Guid Id { get; set; }
}

public class DeleteReleaseMetricSourceConnectionHandler(
    IReleaseMetricSourceConnectionService service,
    ReleaseMetricSourceConnectionAccessGuard accessGuard)
    : IRequestHandler<DeleteReleaseMetricSourceConnection, bool>
{
    public async Task<bool> Handle(DeleteReleaseMetricSourceConnection request, CancellationToken cancellationToken)
    {
        await accessGuard.GetEnvironmentAsync(request.OrgId, request.EnvId);
        if (!await service.DeleteAsync(request.EnvId, request.Id, cancellationToken))
        {
            throw new EntityNotFoundException(nameof(ReleaseMetricSourceConnection), request.Id.ToString());
        }
        return true;
    }
}
