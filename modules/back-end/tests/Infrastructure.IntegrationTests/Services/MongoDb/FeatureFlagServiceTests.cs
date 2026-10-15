using Application.FeatureFlags;
using Domain.FeatureFlags;
using Domain.Segments;
using Domain.Targeting;
using Infrastructure.IntegrationTests.Fixtures;
using Infrastructure.Persistence.MongoDb;
using Infrastructure.Services.MongoDb;
using Microsoft.Extensions.Options;
using System.Text.Json;
using Application.Bases.Exceptions;
using MongoDB.Driver;

namespace Infrastructure.IntegrationTests.Services.MongoDb;

[Collection(MongoCollection.Name)]
public class FeatureFlagServiceTests : IntegrationTestBase
{
    [DockerFact]
    public async Task UpdateAsync_ConcurrentWriters_OnlyOneLoadedVersionCanWin()
    {
        var first = NewService();
        var flag = NewFlag(Guid.NewGuid(), "race");
        await first.AddOneAsync(flag);
        var second = new FeatureFlagService(first.MongoDb);
        var firstRead = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var secondRead = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var writers = new[] { WriteAsync(first, "first", firstRead), WriteAsync(second, "second", secondRead) };
        try
        {
            await Task.WhenAll(firstRead.Task, secondRead.Task).WaitAsync(TimeSpan.FromSeconds(10));
        }
        finally
        {
            release.TrySetResult();
        }

        var results = await Task.WhenAll(writers).WaitAsync(TimeSpan.FromSeconds(10));

        Assert.Single(results, x => x.error == null);
        Assert.IsType<ConflictException>(Assert.Single(results, x => x.error != null).error);
        var stored = await first.GetAsync(flag.EnvId, flag.Key);
        Assert.Equal(results.Single(x => x.error == null).name, stored.Name);
        return;

        async Task<(string name, Exception? error)> WriteAsync(FeatureFlagService service, string name, TaskCompletionSource read)
        {
            var value = await service.GetAsync(flag.EnvId, flag.Key);
            read.SetResult();
            await release.Task;
            value.UpdateName(name, Guid.NewGuid());
            return (name, await Record.ExceptionAsync(() => service.UpdateAsync(value)));
        }
    }

    [DockerFact]
    public async Task UpdateAsync_PendingChangedAfterRead_RejectsStaleReplacement()
    {
        var service = NewService();
        var flag = NewFlag(Guid.NewGuid(), "pending-race");
        await service.AddOneAsync(flag);
        var stale = await service.GetAsync(flag.EnvId, flag.Key);
        var pending = flag.Clone();
        pending.Name = "pending";
        await service.SetPendingAsync(flag.EnvId, flag.Key, pending, 1);
        stale.UpdateName("stale", Guid.NewGuid());

        await Assert.ThrowsAsync<ConflictException>(() => service.UpdateAsync(stale));

        var stored = await service.GetAsync(flag.EnvId, flag.Key);
        Assert.Equal(1, stored.Pending.Version);
        Assert.Equal("pending", stored.Pending.Value.Name);
    }

    [DockerFact]
    public async Task UpdateAsync_MetadataChangedAfterRead_RejectsStaleReplacement()
    {
        var service = NewService();
        var flag = NewFlag(Guid.NewGuid(), "metadata-race");
        await service.AddOneAsync(flag);
        var stale = await service.GetAsync(flag.EnvId, flag.Key);
        var updater = Guid.NewGuid();
        await service.MarkAsUpdatedAsync([flag.Id], updater);
        stale.UpdateName("stale", Guid.NewGuid());

        await Assert.ThrowsAsync<ConflictException>(() => service.UpdateAsync(stale));

        Assert.Equal(updater, (await service.GetAsync(flag.EnvId, flag.Key)).UpdatorId);
    }

    [DockerFact]
    public async Task UpdateAsync_LegacyDocumentWithoutToken_FirstWriteUpgradesAndFencesNextWrite()
    {
        var service = NewService();
        var flag = NewFlag(Guid.NewGuid(), "legacy-race");
        await service.AddOneAsync(flag);
        await service.Collection.UpdateOneAsync(x => x.Id == flag.Id, Builders<FeatureFlag>.Update.Unset("mongoETag"));
        var first = await service.GetAsync(flag.EnvId, flag.Key);
        var stale = await service.GetAsync(flag.EnvId, flag.Key);
        first.UpdateName("first", Guid.NewGuid());
        await service.UpdateAsync(first);
        stale.UpdateName("stale", Guid.NewGuid());

        await Assert.ThrowsAsync<ConflictException>(() => service.UpdateAsync(stale));

        Assert.Equal("first", (await service.GetAsync(flag.EnvId, flag.Key)).Name);
    }

    private readonly MongoDbFixture _fixture;

    public FeatureFlagServiceTests(MongoDbFixture fixture)
    {
        _fixture = fixture;
    }

    private FeatureFlagService NewService()
    {
        var client = new MongoDbClient(Options.Create(new MongoDbOptions
        {
            ConnectionString = _fixture.ConnectionString,
            Database = $"be-ff-{Guid.NewGuid():N}"
        }));
        return new FeatureFlagService(client);
    }

    private static FeatureFlag NewFlag(
        Guid envId,
        string key,
        string? name = null,
        bool isEnabled = true,
        bool isArchived = false,
        string[]? tags = null,
        ICollection<TargetRule>? rules = null)
    {
        var flag = new FeatureFlag(
            envId: envId,
            name: name ?? key,
            description: "test",
            key: key,
            isEnabled: isEnabled,
            variationType: "boolean",
            variations:
            [
                new Variation { Id = "v1", Name = "true", Value = "true" },
                new Variation { Id = "v2", Name = "false", Value = "false" }
            ],
            disabledVariationId: "v2",
            enabledVariationId: "v1",
            tags: tags ?? [],
            currentUserId: Guid.NewGuid())
        {
            IsArchived = isArchived,
            Rules = rules ?? []
        };
        return flag;
    }

    [DockerFact]
    public async Task GetAsync_ByEnvAndKey_ReturnsMatchingFlag()
    {
        var sut = NewService();
        var envId = Guid.NewGuid();
        await sut.AddOneAsync(NewFlag(envId, "wanted"));
        await sut.AddOneAsync(NewFlag(envId, "other"));
        await sut.AddOneAsync(NewFlag(Guid.NewGuid(), "wanted"));

        var found = await sut.GetAsync(envId, "wanted");

        Assert.Equal(envId, found.EnvId);
        Assert.Equal("wanted", found.Key);
    }

    [DockerFact]
    public async Task GetAsync_NoMatch_ThrowsEntityNotFound()
    {
        var sut = NewService();

        await Assert.ThrowsAnyAsync<Exception>(() => sut.GetAsync(Guid.NewGuid(), "missing"));
    }

    [DockerFact]
    public async Task HasKeyBeenUsedAsync_KeyExistsInEnvironment_ReturnsTrue()
    {
        var sut = NewService();
        var envId = Guid.NewGuid();
        await sut.AddOneAsync(NewFlag(envId, "Existing"));

        Assert.True(await sut.HasKeyBeenUsedAsync(envId, "Existing"));
    }

    [DockerFact]
    public async Task HasKeyBeenUsedAsync_KeyOnlyInOtherEnvironment_ReturnsFalse()
    {
        var sut = NewService();
        await sut.AddOneAsync(NewFlag(Guid.NewGuid(), "Existing"));

        Assert.False(await sut.HasKeyBeenUsedAsync(Guid.NewGuid(), "Existing"));
    }

    [DockerFact]
    public async Task HasKeyBeenUsedAsync_IsCaseInsensitive()
    {
        var sut = NewService();
        var envId = Guid.NewGuid();
        await sut.AddOneAsync(NewFlag(envId, "MixedCase"));

        Assert.True(await sut.HasKeyBeenUsedAsync(envId, "mixedcase"));
    }

    [DockerFact]
    public async Task GetListAsync_FiltersByEnvironment()
    {
        var sut = NewService();
        var envId = Guid.NewGuid();
        await sut.AddOneAsync(NewFlag(envId, "in-env-1"));
        await sut.AddOneAsync(NewFlag(envId, "in-env-2"));
        await sut.AddOneAsync(NewFlag(Guid.NewGuid(), "in-other-env"));

        var page = await sut.GetListAsync(envId, new FeatureFlagFilter());

        Assert.Equal(2, page.TotalCount);
        Assert.All(page.Items, f => Assert.Equal(envId, f.EnvId));
    }

    [DockerFact]
    public async Task GetListAsync_ExcludesArchivedByDefault_AndIncludesWhenRequested()
    {
        var sut = NewService();
        var envId = Guid.NewGuid();
        await sut.AddOneAsync(NewFlag(envId, "live"));
        await sut.AddOneAsync(NewFlag(envId, "old", isArchived: true));

        var live = await sut.GetListAsync(envId, new FeatureFlagFilter { IsArchived = false });
        var archived = await sut.GetListAsync(envId, new FeatureFlagFilter { IsArchived = true });

        Assert.Equal(1, live.TotalCount);
        Assert.Equal("live", live.Items.Single().Key);
        Assert.Equal(1, archived.TotalCount);
        Assert.Equal("old", archived.Items.Single().Key);
    }

    [DockerFact]
    public async Task GetListAsync_NameFilterMatchesNameOrKeyCaseInsensitively()
    {
        var sut = NewService();
        var envId = Guid.NewGuid();
        await sut.AddOneAsync(NewFlag(envId, "Search-Match-Key", name: "unrelated"));
        await sut.AddOneAsync(NewFlag(envId, "other-key", name: "Search Match In Name"));
        await sut.AddOneAsync(NewFlag(envId, "skip", name: "skip"));

        var page = await sut.GetListAsync(envId, new FeatureFlagFilter { Name = "SEARCH" });

        Assert.Equal(2, page.TotalCount);
    }

    [DockerFact]
    public async Task GetListAsync_IsEnabledFilter_NarrowsResults()
    {
        var sut = NewService();
        var envId = Guid.NewGuid();
        await sut.AddOneAsync(NewFlag(envId, "on", isEnabled: true));
        await sut.AddOneAsync(NewFlag(envId, "off", isEnabled: false));

        var onlyOn = await sut.GetListAsync(envId, new FeatureFlagFilter { IsEnabled = true });
        var onlyOff = await sut.GetListAsync(envId, new FeatureFlagFilter { IsEnabled = false });

        Assert.Equal("on", Assert.Single(onlyOn.Items).Key);
        Assert.Equal("off", Assert.Single(onlyOff.Items).Key);
    }

    [DockerFact]
    public async Task GetListAsync_TagsFilter_RequiresAllTagsPresent()
    {
        var sut = NewService();
        var envId = Guid.NewGuid();
        await sut.AddOneAsync(NewFlag(envId, "a", tags: ["alpha"]));
        await sut.AddOneAsync(NewFlag(envId, "ab", tags: ["alpha", "beta"]));
        await sut.AddOneAsync(NewFlag(envId, "b", tags: ["beta"]));

        var page = await sut.GetListAsync(envId, new FeatureFlagFilter { Tags = ["alpha", "beta"] });

        Assert.Equal("ab", Assert.Single(page.Items).Key);
    }

    [DockerFact]
    public async Task GetListAsync_SortByKey_OrdersAscending()
    {
        var sut = NewService();
        var envId = Guid.NewGuid();
        await sut.AddOneAsync(NewFlag(envId, "charlie"));
        await sut.AddOneAsync(NewFlag(envId, "alpha"));
        await sut.AddOneAsync(NewFlag(envId, "bravo"));

        var page = await sut.GetListAsync(envId, new FeatureFlagFilter { SortBy = "key" });

        Assert.Equal(new[] { "alpha", "bravo", "charlie" }, page.Items.Select(x => x.Key).ToArray());
    }

    [DockerFact]
    public async Task GetListAsync_DefaultSort_OrdersByCreatedAtDescending()
    {
        var sut = NewService();
        var envId = Guid.NewGuid();
        var oldest = NewFlag(envId, "oldest");
        oldest.CreatedAt = DateTime.UtcNow.AddDays(-2);
        var middle = NewFlag(envId, "middle");
        middle.CreatedAt = DateTime.UtcNow.AddDays(-1);
        var newest = NewFlag(envId, "newest");
        newest.CreatedAt = DateTime.UtcNow;
        await sut.AddManyAsync([oldest, middle, newest]);

        var page = await sut.GetListAsync(envId, new FeatureFlagFilter());

        Assert.Equal(new[] { "newest", "middle", "oldest" }, page.Items.Select(x => x.Key).ToArray());
    }

    [DockerFact]
    public async Task GetListAsync_AppliesPaging()
    {
        var sut = NewService();
        var envId = Guid.NewGuid();
        for (var i = 0; i < 7; i++)
        {
            var flag = NewFlag(envId, $"flag-{i}");
            flag.CreatedAt = DateTime.UtcNow.AddSeconds(i);
            await sut.AddOneAsync(flag);
        }

        var page = await sut.GetListAsync(envId, new FeatureFlagFilter { PageIndex = 1, PageSize = 3 });

        Assert.Equal(7, page.TotalCount);
        Assert.Equal(3, page.Items.Count);
    }

    [DockerFact]
    public async Task GetAllTagsAsync_ReturnsDistinctTagsFromNonArchivedFlags()
    {
        var sut = NewService();
        var envId = Guid.NewGuid();
        await sut.AddOneAsync(NewFlag(envId, "a", tags: ["alpha", "beta"]));
        await sut.AddOneAsync(NewFlag(envId, "b", tags: ["beta", "gamma"]));
        await sut.AddOneAsync(NewFlag(envId, "c", tags: ["delta"], isArchived: true));

        var tags = await sut.GetAllTagsAsync(envId);

        Assert.Equal(new[] { "alpha", "beta", "gamma" }, tags.OrderBy(x => x).ToArray());
    }

    [DockerFact]
    public async Task GetRelatedSegmentsAsync_ReturnsSegmentsReferencedBySegmentConditions()
    {
        var sut = NewService();
        var segmentA = new Segment(Guid.NewGuid(), Guid.NewGuid(), "team-a", "team-a",
            SegmentType.EnvironmentSpecific, [], [], [], [], "");
        var segmentB = new Segment(Guid.NewGuid(), Guid.NewGuid(), "team-b", "team-b",
            SegmentType.EnvironmentSpecific, [], [], [], [], "");
        var unused = new Segment(Guid.NewGuid(), Guid.NewGuid(), "unused", "unused",
            SegmentType.EnvironmentSpecific, [], [], [], [], "");

        await sut.MongoDb.CollectionOf<Segment>().InsertManyAsync([segmentA, segmentB, unused]);

        var rule = new TargetRule
        {
            Id = "r1",
            Name = "r1",
            DispatchKey = "keyId",
            Conditions =
            [
                new Condition
                {
                    Id = "c1",
                    Property = SegmentConsts.IsInSegment,
                    Op = "is in",
                    Value = JsonSerializer.Serialize(new[] { segmentA.Id.ToString(), segmentB.Id.ToString() })
                }
            ],
            Variations = []
        };
        var flag = NewFlag(Guid.NewGuid(), "uses-segments", rules: [rule]);

        var related = await sut.GetRelatedSegmentsAsync([flag]);

        Assert.Equal(
            new[] { segmentA.Id, segmentB.Id }.OrderBy(x => x).ToArray(),
            related.Select(x => x.Id).OrderBy(x => x).ToArray());
    }

    [DockerFact]
    public async Task GetRelatedSegmentsAsync_NoSegmentConditions_ReturnsEmpty()
    {
        var sut = NewService();
        var flag = NewFlag(Guid.NewGuid(), "no-rules");

        var related = await sut.GetRelatedSegmentsAsync([flag]);

        Assert.Empty(related);
    }

    [DockerFact]
    public async Task MarkAsUpdatedAsync_BumpsUpdatedAtAndUpdator()
    {
        var sut = NewService();
        var envId = Guid.NewGuid();
        var flag = NewFlag(envId, "to-bump");
        flag.UpdatedAt = DateTime.UtcNow.AddDays(-10);
        await sut.AddOneAsync(flag);
        var operatorId = Guid.NewGuid();

        await sut.MarkAsUpdatedAsync([flag.Id], operatorId);

        var reloaded = await sut.GetAsync(flag.Id);
        Assert.Equal(operatorId, reloaded.UpdatorId);
        Assert.True(reloaded.UpdatedAt > DateTime.UtcNow.AddMinutes(-1));
    }
}
