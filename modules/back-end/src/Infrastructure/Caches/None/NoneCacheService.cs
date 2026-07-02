using Application.Caches;
using Domain.Environments;
using Domain.FeatureFlags;
using Domain.Segments;
using Domain.Workspaces;

namespace Infrastructure.Caches.None;

public class NoneCacheService : ICacheService
{
    public Task UpsertFlagAsync(FeatureFlag flag) => Task.CompletedTask;

    public Task DeleteFlagAsync(Guid envId, Guid flagId) => Task.CompletedTask;

    public Task UpsertSegmentAsync(ICollection<Guid> envIds, Segment segment) => Task.CompletedTask;

    public Task DeleteSegmentAsync(ICollection<Guid> envIds, Guid segmentId) => Task.CompletedTask;

    public Task UpsertLicenseAsync(Workspace workspace) => Task.CompletedTask;

    public Task UpsertSecretAsync(ResourceDescriptor resourceDescriptor, Secret secret) => Task.CompletedTask;

    public Task DeleteSecretAsync(Secret secret) => Task.CompletedTask;

    public async Task<string> GetOrSetLicenseAsync(Guid workspaceId, Func<Task<string>> licenseGetter)
    {
        var license = await licenseGetter();

        return license;
    }
}