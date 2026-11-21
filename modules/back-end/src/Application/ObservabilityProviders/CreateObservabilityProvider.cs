using System.Text.Json.Serialization;
using Application.Bases;
using Application.Users;
using Domain.ObservabilityProviders;

namespace Application.ObservabilityProviders;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public class CreateObservabilityProvider : ObservabilityProviderRequest, IRequest<ObservabilityProviderVm>
{
    [JsonIgnore] public Guid EnvId { get; set; }
}

public class CreateObservabilityProviderValidator : AbstractValidator<CreateObservabilityProvider>
{
    public CreateObservabilityProviderValidator()
    {
        Include(new ObservabilityProviderRequestValidator());
        RuleFor(x => x.ExpectedVersion).Null().WithErrorCode(ErrorCodes.Invalid("expectedVersion"));
    }
}

public class CreateObservabilityProviderHandler(
    IObservabilityProviderService service, IProviderCredentialProtector protector, ICurrentUser user)
    : IRequestHandler<CreateObservabilityProvider, ObservabilityProviderVm>
{
    public async Task<ObservabilityProviderVm> Handle(CreateObservabilityProvider request, CancellationToken cancellationToken)
    {
        var id = Guid.NewGuid();
        var prepared = ProviderConfiguration.Prepare(request, request.EnvId, id, protector);
        var provider = new ObservabilityProvider
        {
            Id = id,
            EnvId = request.EnvId,
            Name = request.Name.Trim(),
            ProviderType = request.ProviderType,
            ProviderSchemaVersion = request.ProviderSchemaVersion,
            ConnectionConfiguration = prepared.ConnectionConfiguration,
            ProtectedCredential = prepared.ProtectedCredential,
            CreatorId = user.Id,
            UpdatorId = user.Id
        };
        await service.AddAsync(provider, cancellationToken);
        return ObservabilityProviderVm.From(provider);
    }
}
