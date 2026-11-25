using System.Text.Json;
using System.Text.Json.Serialization;
using Application.Bases.Exceptions;
using Domain.ReleaseMetricSourceConnections;

namespace Application.ReleaseMetricSourceConnections;

public class UpdateReleaseMetricSourceConnection : ReleaseMetricSourceConnectionBase, IRequest<ReleaseMetricSourceConnectionVm>
{
    [JsonIgnore] public Guid Id { get; set; }
}

public class UpdateReleaseMetricSourceConnectionHandler(
    IReleaseMetricSourceConnectionService service,
    IReleaseMetricSourceCredentialProtector protector,
    IValidator<ReleaseMetricSourceConnectionBase> validator,
    ReleaseMetricSourceConnectionAccessGuard accessGuard)
    : IRequestHandler<UpdateReleaseMetricSourceConnection, ReleaseMetricSourceConnectionVm>
{
    public async Task<ReleaseMetricSourceConnectionVm> Handle(UpdateReleaseMetricSourceConnection request, CancellationToken cancellationToken)
    {
        var scope = await accessGuard.GetEnvironmentAsync(request.OrgId, request.EnvId);
        var connection = await service.FindAsync(request.EnvId, request.Id, cancellationToken)
            ?? throw new EntityNotFoundException(nameof(ReleaseMetricSourceConnection), request.Id.ToString());

        request.Name ??= connection.Name;
        request.ProviderType ??= connection.ProviderType;
        if (request.ProviderConfig.ValueKind == JsonValueKind.Undefined)
        {
            request.ProviderConfig = connection.ConnectionConfiguration.ProviderConfig;
        }
        if (request.Authentication.ValueKind == JsonValueKind.Undefined)
        {
            request.Authentication = connection.ConnectionConfiguration.Authentication;
        }
        validator.ValidateAndThrow(request);

        var previousUpdatedAt = connection.UpdatedAt;
        var (credential, remove) = ReleaseMetricSourceCredentialUpdate.Resolve(request, connection, scope, protector);
        connection.Update(request.Name.Trim(), request.ProviderType,
            new ReleaseMetricSourceConnectionSettings(request.ProviderConfig, request.Authentication));
        if (credential.HasValue)
        {
            connection.ProtectedCredential = protector.Protect(scope, connection, credential.Value);
        }
        else if (remove)
        {
            connection.ProtectedCredential = null;
        }

        if (await service.UpdateAsync(connection, previousUpdatedAt, cancellationToken))
        {
            return ReleaseMetricSourceConnectionVm.From(connection);
        }

        if (await service.FindAsync(request.EnvId, request.Id, cancellationToken) is null)
        {
            throw new EntityNotFoundException(nameof(ReleaseMetricSourceConnection), request.Id.ToString());
        }

        throw new ConflictException(nameof(ReleaseMetricSourceConnection), request.Id);
    }
}
