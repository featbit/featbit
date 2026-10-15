using Application.Bases.Exceptions;
using Application.ControlPlane;
using Application.FeatureFlags;
using Application.Segments;
using Application.Services;
using Application.Users;
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.Segments;
using Infrastructure.IntegrationTests.Fixtures;
using Infrastructure.IntegrationTests.Support;
using Infrastructure.Persistence.EntityFrameworkCore;
using Infrastructure.Persistence.MongoDb;
using MediatR;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Infrastructure.IntegrationTests.Services;

public abstract class GatedCommitMutationTests : IntegrationTestBase, IDisposable
{
    protected static readonly IConfiguration Gated = new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string,string?>
        {
            ["UseControlPlane"] = "true", ["ControlPlane:ConsistencyMode"] = "GatedCommit"
        }).Build();
    protected abstract IFeatureFlagService Flags();
    protected abstract ISegmentService Segments();
    public virtual void Dispose() { }
    private static FeatureFlag Flag() => new(Guid.NewGuid(), "old", "test", Guid.NewGuid().ToString("N"), true,
        "boolean", [new Variation { Id = "v1", Value = "true" }, new Variation { Id = "v2", Value = "false" }],
        "v2", "v1", [], Guid.NewGuid()) { Id = Guid.NewGuid() };
    private static Segment Segment() => new(Guid.NewGuid(), Guid.NewGuid(), "old", Guid.NewGuid().ToString("N"),
        SegmentType.EnvironmentSpecific, [], [], [], [], "test") { Id = Guid.NewGuid() };
    private static OnFeatureFlagChanged Change(FeatureFlag value) => new(value, Operations.Update,
        new DataChange(), value.UpdatorId);
    private static OnSegmentChange Change(Segment value, Guid actor) => new(value, Operations.Update,
        new DataChange(), actor, isTargetingChange: true);

    [DockerFact]
    public async Task NormalUpdateVariations_FailedPublication_KeepsCommittedReadsAndBackfillOld()
    {
        var original = Flag();
        await Flags().AddOneAsync(original);
        var handler = new UpdateVariationsHandler(Flags(), new User(), new UnavailablePublisher());
        await Assert.ThrowsAsync<IOException>(() => handler.Handle(new UpdateVariations
        {
            EnvId = original.EnvId, Key = original.Key, Revision = original.Revision,
            Variations = [new Variation { Id = "v1", Value = "false" }, new Variation { Id = "v2", Value = "true" }]
        }, CancellationToken.None));
        var service = Flags();
        Assert.Equal("true", (await service.GetCommittedAsync(original.EnvId, original.Key)).Variations.First().Value);
        Assert.Equal("true", (await service.GetAllCommittedAsync()).Single(x => x.Id == original.Id).Variations.First().Value);
        var staged = await service.GetAsync(original.EnvId, original.Key);
        Assert.Equal("false", staged.Pending.Value.Variations.First().Value);
        Assert.False(staged.Pending.IsCommitted);
        Assert.True(await service.PromotePendingForPublicationAsync(original.EnvId, original.Key, staged.Pending.Version));
        Assert.Equal("false", (await Flags().GetCommittedAsync(original.EnvId, original.Key)).Variations.First().Value);
    }

    [DockerFact]
    public async Task SegmentMutation_PreservesCommittedSnapshotAndExactAttribution()
    {
        var original = Segment();
        await Segments().AddOneAsync(original);
        var desired = await Segments().GetAsync(original.Id);
        desired.UpdateTargeting(["new-user"], [], []);
        var actor = Guid.NewGuid();
        await Segments().SaveChangeAsync(Change(desired, actor));
        Assert.Empty((await Segments().GetCommittedAsync(original.Id)).Included);
        Assert.Empty((await Segments().GetAllCommittedAsync()).Single(x => x.Id == original.Id).Included);
        var staged = await Segments().GetAsync(original.Id);
        Assert.Equal(new[] { "new-user" }, staged.Pending.Value.Included);
        Assert.Equal(actor, staged.Pending.OperatorId);
        Assert.Equal(Operations.Update, staged.Pending.Operation);
        Assert.True(staged.Pending.IsTargetingChange);
    }

    [DockerFact]
    public async Task Creation_RemainsArchivedUntilPromotion_AndCannotBeDeletedWhilePending()
    {
        var flag = Flag();
        await Flags().SaveChangeAsync(new OnFeatureFlagChanged(flag, Operations.Create, new DataChange(), Guid.NewGuid()), true);
        var segment = Segment();
        await Segments().SaveChangeAsync(new OnSegmentChange(segment, Operations.Create, new DataChange(), Guid.NewGuid()), true);
        await Assert.ThrowsAsync<EntityNotFoundException>(() => Flags().GetCommittedAsync(flag.EnvId, flag.Key));
        await Assert.ThrowsAsync<EntityNotFoundException>(() => Segments().GetCommittedAsync(segment.Id));
        Assert.DoesNotContain(await Flags().GetAllCommittedAsync(), x => x.Id == flag.Id);
        Assert.DoesNotContain(await Segments().GetAllCommittedAsync(), x => x.Id == segment.Id);
        await Assert.ThrowsAsync<ConflictException>(() => Flags().DeleteOneAsync(flag.Id));
        await Assert.ThrowsAsync<ConflictException>(() => Segments().DeleteOneAsync(segment.Id));
        var flagVersion = (await Flags().GetAsync(flag.EnvId, flag.Key)).Pending.Version;
        var segmentVersion = (await Segments().GetAsync(segment.Id)).Pending.Version;
        Assert.True(await Flags().PromotePendingForPublicationAsync(flag.EnvId, flag.Key, flagVersion));
        Assert.True(await Segments().PromotePendingForPublicationAsync(segment.Id, segmentVersion));
        Assert.False((await Flags().GetCommittedAsync(flag.EnvId, flag.Key)).IsArchived);
        Assert.False((await Segments().GetCommittedAsync(segment.Id)).IsArchived);
    }

    [DockerFact]
    public async Task FlagPublicationReceipt_SurvivesPromotion_BlocksReplacement_AndRequiresMatchingAcknowledgment()
    {
        var flag = Flag(); await Flags().AddOneAsync(flag);
        var stale = await Flags().GetAsync(flag.EnvId, flag.Key);
        var desired = await Flags().GetAsync(flag.EnvId, flag.Key);
        desired.UpdateName("new", Guid.NewGuid());
        await Flags().SaveChangeAsync(Change(desired));
        var version = (await Flags().GetAsync(flag.EnvId, flag.Key)).Pending.Version;
        Assert.True(await Flags().PromotePendingForPublicationAsync(flag.EnvId, flag.Key, version));
        var receipt = await Flags().GetAsync(flag.EnvId, flag.Key);
        Assert.True(receipt.Pending.IsCommitted);
        Assert.Equal(version, new DateTimeOffset(receipt.UpdatedAt).ToUnixTimeMilliseconds());
        Assert.False(await Flags().PromotePendingForPublicationAsync(flag.EnvId, flag.Key, version));
        var another = await Flags().GetAsync(flag.EnvId, flag.Key);
        another.UpdateName("overwrite", Guid.NewGuid());
        await Assert.ThrowsAsync<ConflictException>(() => Flags().SaveChangeAsync(Change(another)));
        await Assert.ThrowsAsync<ConflictException>(() => Flags().SetPendingAsync(flag.EnvId, flag.Key, stale, version + 1));
        Assert.False(await Flags().AcknowledgePublicationAsync(flag.EnvId, flag.Key, version + 1));
        Assert.True(await Flags().AcknowledgePublicationAsync(flag.EnvId, flag.Key, version));
        Assert.Null((await Flags().GetAsync(flag.EnvId, flag.Key)).Pending);
        stale.UpdateName("stale", Guid.NewGuid());
        await Assert.ThrowsAsync<ConflictException>(() => Flags().SaveChangeAsync(Change(stale)));
        var next = await Flags().GetAsync(flag.EnvId, flag.Key);
        next.UpdateName("next", Guid.NewGuid());
        await Flags().SaveChangeAsync(Change(next));
        Assert.True((await Flags().GetAsync(flag.EnvId, flag.Key)).Pending.Version > version);
    }

    [DockerFact]
    public async Task SegmentPublicationReceipt_SurvivesPromotion_AndRequiresMatchingAcknowledgment()
    {
        var segment = Segment(); await Segments().AddOneAsync(segment);
        var stale = await Segments().GetAsync(segment.Id);
        var desired = await Segments().GetAsync(segment.Id);
        desired.UpdateName("new");
        await Segments().SaveChangeAsync(Change(desired, Guid.NewGuid()));
        var version = (await Segments().GetAsync(segment.Id)).Pending.Version;
        Assert.True(await Segments().PromotePendingForPublicationAsync(segment.Id, version));
        var receipt = await Segments().GetAsync(segment.Id);
        Assert.True(receipt.Pending.IsCommitted);
        Assert.Equal(version, new DateTimeOffset(receipt.UpdatedAt).ToUnixTimeMilliseconds());
        Assert.False(await Segments().PromotePendingForPublicationAsync(segment.Id, version));
        await Assert.ThrowsAsync<ConflictException>(() => Segments().SetPendingAsync(segment.Id, stale, version + 1));
        Assert.False(await Segments().AcknowledgePublicationAsync(segment.Id, version + 1));
        Assert.True(await Segments().AcknowledgePublicationAsync(segment.Id, version));
        stale.UpdateName("stale");
        await Assert.ThrowsAsync<ConflictException>(() => Segments().SaveChangeAsync(Change(stale, Guid.NewGuid())));
        var next = await Segments().GetAsync(segment.Id);
        next.UpdateName("next");
        await Segments().SaveChangeAsync(Change(next, Guid.NewGuid()));
        Assert.True((await Segments().GetAsync(segment.Id)).Pending.Version > version);
    }

    private sealed class User : ICurrentUser { public Guid Id { get; } = Guid.NewGuid(); }
    private sealed class UnavailablePublisher : IPublisher
    {
        public Task Publish(object notification, CancellationToken cancellationToken = default) => throw new IOException("offline");
        public Task Publish<TNotification>(TNotification notification, CancellationToken cancellationToken = default)
            where TNotification : INotification => throw new IOException("offline");
    }
}

[Collection(MongoCollection.Name)]
public sealed class MongoGatedCommitMutationTests(MongoDbFixture fixture) : GatedCommitMutationTests
{
    private readonly string _database = "gated-" + Guid.NewGuid().ToString("N");
    private MongoDbClient Client() => new(Options.Create(new MongoDbOptions
        { ConnectionString = fixture.ConnectionString, Database = _database }));
    protected override IFeatureFlagService Flags() => new Infrastructure.Services.MongoDb.FeatureFlagService(Client(), Gated);
    protected override ISegmentService Segments() => new Infrastructure.Services.MongoDb.SegmentService(Client(),
        NullLogger<Infrastructure.Services.MongoDb.SegmentService>.Instance, Gated);
}

[Collection(FeatBitPostgresCollection.Name)]
public sealed class PostgresGatedCommitMutationTests(FeatBitPostgresFixture fixture) : GatedCommitMutationTests
{
    private readonly List<AppDbContext> _contexts = [];
    private AppDbContext Context()
    {
        var context = AppDbContextFactory.Create(fixture.ConnectionString); _contexts.Add(context); return context;
    }
    protected override IFeatureFlagService Flags() => new Infrastructure.Services.EntityFrameworkCore.FeatureFlagService(Context(),
        NullLogger<Infrastructure.Services.EntityFrameworkCore.FeatureFlagService>.Instance, Gated);
    protected override ISegmentService Segments() => new Infrastructure.Services.EntityFrameworkCore.SegmentService(Context(),
        NullLogger<Infrastructure.Services.EntityFrameworkCore.SegmentService>.Instance, Gated);
    public override void Dispose() { foreach (var context in _contexts) context.Dispose(); }
}
