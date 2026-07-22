using Application.Caches;
using Domain.Connections;
using Domain.Environments;
using Domain.FeatureFlags;
using Domain.Health;
using Domain.Segments;
using Domain.Workspaces;

namespace Infrastructure.Caches.None;

public class NoneCacheService : ICacheService
{
    public Task UpsertFlagAsync(FeatureFlag flag) => Task.CompletedTask;

    // #105: None cache writes are no-ops that never fail, so there is nothing to reject; report
    // "accepted" (true) rather than inventing a guard result that doesn't apply here.
    public Task<bool> UpsertFlagIfNewerAsync(FeatureFlag flag) => Task.FromResult(true);

    public Task<bool> StageFlagAsync(FeatureFlag flag, long ts) => Task.FromResult(true);

    public Task<bool> CommitFlagAsync(Guid envId, string flagId, long ts) => Task.FromResult(true);

    public Task<bool> HasStagedFlagAsync(Guid id, long ts) => Task.FromResult(false);

    public Task DeleteFlagAsync(Guid envId, Guid flagId) => Task.CompletedTask;

    public Task UpsertSegmentAsync(ICollection<Guid> envIds, Segment segment) => Task.CompletedTask;

    public Task<bool> UpsertSegmentIfNewerAsync(ICollection<Guid> envIds, Segment segment) => Task.FromResult(true);

    public Task<bool> StageSegmentAsync(Segment segment, long ts) => Task.FromResult(true);

    public Task<bool> CommitSegmentAsync(ICollection<Guid> envIds, string segmentId, long ts) => Task.FromResult(true);

    public Task<bool> HasStagedSegmentAsync(Guid id, long ts) => Task.FromResult(false);

    public Task DeleteSegmentAsync(ICollection<Guid> envIds, Guid segmentId) => Task.CompletedTask;

    public Task UpsertLicenseAsync(Workspace workspace) => Task.CompletedTask;

    public Task UpsertSecretAsync(ResourceDescriptor resourceDescriptor, Secret secret) => Task.CompletedTask;

    public Task DeleteSecretAsync(Secret secret) => Task.CompletedTask;

    public async Task<string> GetOrSetLicenseAsync(Guid workspaceId, Func<Task<string>> licenseGetter)
    {
        var license = await licenseGetter();

        return license;
    }

    public Task UpsertConnectionMadeAsync(ConnectionMessage connectionMessage) => Task.CompletedTask;
     
    public Task DeleteConnectionMadeAsync(ConnectionMessage connectionMessage) => Task.CompletedTask;

    public Task UpsertPodHeartbeat(HealthMessage healthMessage) => Task.CompletedTask;

    public Task DeletePodConnection(Guid podId) => Task.CompletedTask;

    public Task<List<HealthMessage>> GetAllHealthMessages() => Task.FromResult(new List<HealthMessage>());
}