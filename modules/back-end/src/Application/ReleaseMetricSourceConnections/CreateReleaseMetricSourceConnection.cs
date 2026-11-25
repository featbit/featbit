using Domain.ReleaseMetricSourceConnections;

namespace Application.ReleaseMetricSourceConnections;

public class CreateReleaseMetricSourceConnection : ReleaseMetricSourceConnectionBase, IRequest<ReleaseMetricSourceConnectionVm>
{
}

public class CreateReleaseMetricSourceConnectionValidator : AbstractValidator<CreateReleaseMetricSourceConnection>
{
    public CreateReleaseMetricSourceConnectionValidator()
    {
        Include(new ReleaseMetricSourceConnectionBaseValidator());
    }
}

public class CreateReleaseMetricSourceConnectionHandler(
    IReleaseMetricSourceConnectionService service,
    IReleaseMetricSourceCredentialProtector protector,
    ReleaseMetricSourceConnectionAccessGuard accessGuard)
    : IRequestHandler<CreateReleaseMetricSourceConnection, ReleaseMetricSourceConnectionVm>
{
    public async Task<ReleaseMetricSourceConnectionVm> Handle(CreateReleaseMetricSourceConnection request, CancellationToken cancellationToken)
    {
        var scope = await accessGuard.GetEnvironmentAsync(request.OrgId, request.EnvId);
        var connection = new ReleaseMetricSourceConnection(request.EnvId, request.Name.Trim(), request.ProviderType,
            new ReleaseMetricSourceConnectionSettings(request.ProviderConfig, request.Authentication));

        var (credential, _) = ReleaseMetricSourceCredentialUpdate.Resolve(request, null, scope, protector);
        if (credential.HasValue)
        {
            connection.ProtectedCredential = protector.Protect(scope, connection, credential.Value);
        }

        await service.AddAsync(connection, cancellationToken);
        return ReleaseMetricSourceConnectionVm.From(connection);
    }
}
