using System.Text.Json.Serialization;
using Application.Bases.Exceptions;
using Domain.ReleaseMetricSourceConnections;

namespace Application.ReleaseMetricSourceConnections;

public class UpdateReleaseMetricSourceConnection : ReleaseMetricSourceConnectionBase, IRequest<ReleaseMetricSourceConnectionVm>
{
    [JsonIgnore] public Guid Id { get; set; }
}

public class UpdateReleaseMetricSourceConnectionValidator : AbstractValidator<UpdateReleaseMetricSourceConnection>
{
    public UpdateReleaseMetricSourceConnectionValidator()
    {
        Include(new ReleaseMetricSourceConnectionBaseValidator());
    }
}

public class UpdateReleaseMetricSourceConnectionHandler(
    IReleaseMetricSourceConnectionService service,
    ReleaseMetricSourceConnectionAccessGuard accessGuard)
    : IRequestHandler<UpdateReleaseMetricSourceConnection, ReleaseMetricSourceConnectionVm>
{
    public async Task<ReleaseMetricSourceConnectionVm> Handle(UpdateReleaseMetricSourceConnection request, CancellationToken cancellationToken)
    {
        await accessGuard.GetEnvironmentAsync(request.OrgId, request.EnvId);
        var connection = await service.FindAsync(request.EnvId, request.Id, cancellationToken)
            ?? throw new EntityNotFoundException(nameof(ReleaseMetricSourceConnection), request.Id.ToString());
        connection.Update(request.Name.Trim(), request.ProviderType,
            new ReleaseMetricSourceConnectionSettings(request.ProviderConfig, request.Authentication));

        if (!await service.UpdateAsync(connection, cancellationToken))
        {
            throw new EntityNotFoundException(nameof(ReleaseMetricSourceConnection), request.Id.ToString());
        }
        return ReleaseMetricSourceConnectionVm.From(connection);
    }
}
