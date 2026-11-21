#nullable enable

using Domain.ObservabilityProviders;

namespace Application.Services;

public interface IObservabilityProviderService
{
    Task<IReadOnlyList<ObservabilityProvider>> GetListAsync(Guid envId, CancellationToken cancellationToken);
    Task<ObservabilityProvider?> FindAsync(Guid envId, Guid id, CancellationToken cancellationToken);
    Task AddAsync(ObservabilityProvider provider, CancellationToken cancellationToken);
    Task<bool> UpdateAsync(ObservabilityProvider provider, long expectedVersion, CancellationToken cancellationToken);
    Task<bool> DeleteAsync(Guid envId, Guid id, Guid operatorId, CancellationToken cancellationToken);
}
