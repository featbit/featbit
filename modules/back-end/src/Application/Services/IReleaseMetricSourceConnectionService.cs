#nullable enable

using Domain.ReleaseMetricSourceConnections;

namespace Application.Services;

public interface IReleaseMetricSourceConnectionService
{
    Task<IReadOnlyList<ReleaseMetricSourceConnection>> GetListAsync(Guid envId, CancellationToken cancellationToken);
    Task<ReleaseMetricSourceConnection?> FindAsync(Guid envId, Guid id, CancellationToken cancellationToken);
    Task AddAsync(ReleaseMetricSourceConnection connection, CancellationToken cancellationToken);
    Task<bool> UpdateAsync(ReleaseMetricSourceConnection connection, DateTime previousUpdatedAt, CancellationToken cancellationToken);
    Task<bool> DeleteAsync(Guid envId, Guid id, CancellationToken cancellationToken);
}
