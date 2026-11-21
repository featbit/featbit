using Application.Bases.Exceptions;
using Application.Users;
using Domain.ObservabilityProviders;

namespace Application.ObservabilityProviders;

public class DeleteObservabilityProvider : IRequest<bool>
{
    public Guid EnvId { get; set; }
    public Guid Id { get; set; }
}

public class DeleteObservabilityProviderHandler(IObservabilityProviderService service, ICurrentUser user)
    : IRequestHandler<DeleteObservabilityProvider, bool>
{
    public async Task<bool> Handle(DeleteObservabilityProvider request, CancellationToken cancellationToken)
    {
        if (!await service.DeleteAsync(request.EnvId, request.Id, user.Id, cancellationToken))
        {
            throw new EntityNotFoundException(nameof(ObservabilityProvider), request.Id.ToString());
        }
        return true;
    }
}
