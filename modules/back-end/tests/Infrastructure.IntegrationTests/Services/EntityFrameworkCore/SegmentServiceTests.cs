using Application.Segments;
using Domain.FeatureFlags;
using Domain.Segments;
using Domain.Targeting;
using Infrastructure.IntegrationTests.Fixtures;
using Infrastructure.IntegrationTests.Support;
using Infrastructure.Persistence.EntityFrameworkCore;
using Infrastructure.Services.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using System.Text.Json;

namespace Infrastructure.IntegrationTests.Services.EntityFrameworkCore;

[Collection(FeatBitPostgresCollection.Name)]
public class SegmentServiceTests : IntegrationTestBase
{
    private readonly FeatBitPostgresFixture _fixture;

    public SegmentServiceTests(FeatBitPostgresFixture fixture)
    {
        _fixture = fixture;
    }

    private (SegmentService Service, AppDbContext Db) NewService()
    {
        var db = AppDbContextFactory.Create(_fixture.ConnectionString);
        return (new SegmentService(db, NullLogger<SegmentService>.Instance), db);
    }

    private static Segment NewSegment(
        Guid workspaceId,
        Guid envId,
        string key,
        string type = SegmentType.EnvironmentSpecific,
        string[]? scopes = null,
        bool isArchived = false,
        string[]? tags = null)
    {
        return new Segment(workspaceId, envId, key, key, type, scopes ?? [], [], [], [], "desc")
        {
            Id = Guid.NewGuid(),
            IsArchived = isArchived,
            Tags = tags ?? []
        };
    }

    [DockerFact]
    public async Task IsKeyUsedAsync_EnvironmentSpecific_ChecksOnlyMatchingEnvironment()
    {
        var (sut, db) = NewService();
        await using var _ = db;
        var workspaceId = Guid.NewGuid();
        var envId = Guid.NewGuid();
        await sut.AddOneAsync(NewSegment(workspaceId, envId, "Existing"));

        Assert.True(await sut.IsKeyUsedAsync(workspaceId, SegmentType.EnvironmentSpecific, envId, "existing"));
        Assert.False(await sut.IsKeyUsedAsync(workspaceId, SegmentType.EnvironmentSpecific, Guid.NewGuid(), "existing"));
    }

    [DockerFact]
    public async Task IsKeyUsedAsync_Shared_ChecksAcrossWorkspaceIgnoringEnvironment()
    {
        var (sut, db) = NewService();
        await using var _ = db;
        var workspaceId = Guid.NewGuid();
        await sut.AddOneAsync(NewSegment(workspaceId, Guid.NewGuid(), "shared-key", type: SegmentType.Shared));

        Assert.True(await sut.IsKeyUsedAsync(workspaceId, SegmentType.Shared, Guid.NewGuid(), "SHARED-KEY"));
        Assert.False(await sut.IsKeyUsedAsync(Guid.NewGuid(), SegmentType.Shared, Guid.NewGuid(), "shared-key"));
    }

    [DockerFact]
    public async Task GetListAsync_Paged_FiltersByWorkspaceAndScopeAndArchived()
    {
        var (sut, db) = NewService();
        await using var _ = db;
        var workspaceId = Guid.NewGuid();
        var scope = "organization/org-key:project/proj-key:env/env-key";
        await sut.AddOneAsync(NewSegment(workspaceId, Guid.NewGuid(), "live-1", scopes: [scope]));
        await sut.AddOneAsync(NewSegment(workspaceId, Guid.NewGuid(), "live-2", scopes: [scope]));
        await sut.AddOneAsync(NewSegment(workspaceId, Guid.NewGuid(), "old", scopes: [scope], isArchived: true));
        await sut.AddOneAsync(NewSegment(workspaceId, Guid.NewGuid(), "other-scope", scopes: ["organization/other:project/other:env/other"]));
        await sut.AddOneAsync(NewSegment(Guid.NewGuid(), Guid.NewGuid(), "other-ws", scopes: [scope]));

        var live = await sut.GetListAsync(workspaceId, scope, new SegmentFilter { IsArchived = false });
        var archived = await sut.GetListAsync(workspaceId, scope, new SegmentFilter { IsArchived = true });

        Assert.Equal(2, live.TotalCount);
        Assert.All(live.Items, x => Assert.Equal(workspaceId, x.WorkspaceId));
        Assert.Equal(1, archived.TotalCount);
        Assert.Equal("old", archived.Items.Single().Key);
    }

    [DockerFact]
    public async Task GetListAsync_Paged_NameFilterIsCaseInsensitive()
    {
        var (sut, db) = NewService();
        await using var _ = db;
        var workspaceId = Guid.NewGuid();
        var scope = "org/o:project/p:env/e";
        await sut.AddOneAsync(NewSegment(workspaceId, Guid.NewGuid(), "ApiTeam", scopes: [scope]));
        await sut.AddOneAsync(NewSegment(workspaceId, Guid.NewGuid(), "WebTeam", scopes: [scope]));

        var page = await sut.GetListAsync(workspaceId, scope, new SegmentFilter { Name = "API" });

        Assert.Equal("ApiTeam", Assert.Single(page.Items).Key);
    }

    [DockerFact]
    public async Task GetListAsync_NonPaged_ExcludesArchivedByDefault()
    {
        var (sut, db) = NewService();
        await using var _ = db;
        var workspaceId = Guid.NewGuid();
        var scope = "org/o:project/p:env/e";
        await sut.AddOneAsync(NewSegment(workspaceId, Guid.NewGuid(), "live", scopes: [scope]));
        await sut.AddOneAsync(NewSegment(workspaceId, Guid.NewGuid(), "old", scopes: [scope], isArchived: true));

        var withoutArchived = await sut.GetListAsync(workspaceId, scope);
        var withArchived = await sut.GetListAsync(workspaceId, scope, includeArchived: true);

        Assert.Equal("live", Assert.Single(withoutArchived).Key);
        Assert.Equal(2, withArchived.Count);
    }

    [DockerFact]
    public async Task GetAllTagsAsync_ReturnsDistinctTagsFromNonArchivedSegmentsInEnvironment()
    {
        var (sut, db) = NewService();
        await using var _ = db;
        var envId = Guid.NewGuid();
        await sut.AddOneAsync(NewSegment(Guid.NewGuid(), envId, "a", tags: ["alpha", "beta"]));
        await sut.AddOneAsync(NewSegment(Guid.NewGuid(), envId, "b", tags: ["beta", "gamma"]));
        await sut.AddOneAsync(NewSegment(Guid.NewGuid(), envId, "c", tags: ["delta"], isArchived: true));
        await sut.AddOneAsync(NewSegment(Guid.NewGuid(), Guid.NewGuid(), "d", tags: ["other-env"]));

        var tags = await sut.GetAllTagsAsync(envId);

        Assert.Equal(new[] { "alpha", "beta", "gamma" }, tags.OrderBy(x => x).ToArray());
    }

    [DockerFact]
    public async Task GetFlagReferencesAsync_ReturnsFlagsWhoseRulesReferenceTheSegment()
    {
        var (sut, db) = NewService();
        await using var _ = db;
        var envId = Guid.NewGuid();
        var segmentId = Guid.NewGuid();

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
                    Value = JsonSerializer.Serialize(new[] { segmentId.ToString() })
                }
            ],
            Variations = []
        };
        var referencingFlag = new FeatureFlag(envId, "uses-seg", "", "uses-seg", true, "boolean",
            [new Variation { Id = "v1", Name = "on", Value = "true" }],
            "v1", "v1", [], Guid.NewGuid()) { Id = Guid.NewGuid(), Rules = [rule] };
        var unrelatedFlag = new FeatureFlag(envId, "no-ref", "", "no-ref", true, "boolean",
            [new Variation { Id = "v1", Name = "on", Value = "true" }],
            "v1", "v1", [], Guid.NewGuid()) { Id = Guid.NewGuid() };

        db.Set<FeatureFlag>().AddRange(referencingFlag, unrelatedFlag);
        await db.SaveChangesAsync();

        var refs = await sut.GetFlagReferencesAsync(envId, segmentId);

        var single = Assert.Single(refs);
        Assert.Equal("uses-seg", single.Key);
        Assert.Equal(envId, single.EnvId);
    }

    [DockerFact]
    public async Task GetEnvironmentIdsAsync_EnvironmentSpecificSegment_ReturnsSegmentsEnvId()
    {
        var (sut, db) = NewService();
        await using var _ = db;
        var envId = Guid.NewGuid();
        var seg = NewSegment(Guid.NewGuid(), envId, "k");

        var result = await sut.GetEnvironmentIdsAsync(seg);

        Assert.Equal(new[] { envId }, result);
    }
}
