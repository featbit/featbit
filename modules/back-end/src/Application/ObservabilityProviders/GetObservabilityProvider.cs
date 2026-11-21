using Application.Bases.Exceptions;
using Domain.ObservabilityProviders;

namespace Application.ObservabilityProviders;

public class GetObservabilityProvider : IRequest<ObservabilityProviderVm>
{
    public Guid EnvId { get; set; }
    public Guid Id { get; set; }
}

public class GetObservabilityProviderHandler(IObservabilityProviderService service)
    : IRequestHandler<GetObservabilityProvider, ObservabilityProviderVm>
{
    public async Task<ObservabilityProviderVm> Handle(GetObservabilityProvider request, CancellationToken cancellationToken)
    {
        var provider = await service.FindAsync(request.EnvId, request.Id, cancellationToken)
            ?? throw new EntityNotFoundException(nameof(ObservabilityProvider), request.Id.ToString());
        return ObservabilityProviderVm.From(provider);
    }
}
