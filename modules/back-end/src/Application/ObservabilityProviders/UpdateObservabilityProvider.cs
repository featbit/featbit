using System.Text.Json.Serialization;
using Application.Bases;
using Application.Bases.Exceptions;
using Application.Users;
using Domain.ObservabilityProviders;

namespace Application.ObservabilityProviders;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public class UpdateObservabilityProvider : ObservabilityProviderRequest, IRequest<ObservabilityProviderVm>
{
    [JsonIgnore] public Guid EnvId { get; set; }
    [JsonIgnore] public Guid Id { get; set; }
}

public class UpdateObservabilityProviderValidator : AbstractValidator<UpdateObservabilityProvider>
{
    public UpdateObservabilityProviderValidator()
    {
        Include(new ObservabilityProviderRequestValidator());
        RuleFor(x => x.ExpectedVersion)
            .NotNull().WithErrorCode(ErrorCodes.Required("expectedVersion"))
            .GreaterThan(0).WithErrorCode(ErrorCodes.Invalid("expectedVersion"));
    }
}

public class UpdateObservabilityProviderHandler(
    IObservabilityProviderService service, IProviderCredentialProtector protector, ICurrentUser user)
    : IRequestHandler<UpdateObservabilityProvider, ObservabilityProviderVm>
{
    public async Task<ObservabilityProviderVm> Handle(UpdateObservabilityProvider request, CancellationToken cancellationToken)
    {
        var provider = await service.FindAsync(request.EnvId, request.Id, cancellationToken)
            ?? throw new EntityNotFoundException(nameof(ObservabilityProvider), request.Id.ToString());
        if (provider.Version != request.ExpectedVersion)
        {
            throw new ConflictException(nameof(ObservabilityProvider), provider.Id);
        }

        var prepared = ProviderConfiguration.Prepare(request, request.EnvId, provider.Id, protector, provider);
        if (provider.ProviderType != request.ProviderType || provider.ProviderSchemaVersion != request.ProviderSchemaVersion ||
            !ProviderConfiguration.HasSameIdentity(provider.ConnectionConfiguration, prepared.ConnectionConfiguration))
        {
            provider.Revision++;
        }

        provider.Name = request.Name.Trim();
        provider.ProviderType = request.ProviderType;
        provider.ProviderSchemaVersion = request.ProviderSchemaVersion;
        provider.ConnectionConfiguration = prepared.ConnectionConfiguration;
        provider.ProtectedCredential = prepared.ProtectedCredential;
        provider.Version++;
        provider.MarkAsUpdated(user.Id);

        if (!await service.UpdateAsync(provider, request.ExpectedVersion.Value, cancellationToken))
        {
            throw new ConflictException(nameof(ObservabilityProvider), provider.Id);
        }
        return ObservabilityProviderVm.From(provider);
    }
}
