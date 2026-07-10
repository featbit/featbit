using Infrastructure.IntegrationTests.Fixtures;
using Infrastructure.IntegrationTests.Support;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.IntegrationTests.Smoke;

[Collection(FeatBitPostgresCollection.Name)]
[Trait("Category", "Integration")]
public class FeatBitPostgresFixtureSmokeTests
{
    private readonly FeatBitPostgresFixture _fixture;

    public FeatBitPostgresFixtureSmokeTests(FeatBitPostgresFixture fixture)
    {
        _fixture = fixture;
    }

    [DockerFact]
    public async Task AppDbContext_OpensConnection_AgainstReplayedSchema()
    {
        await using var db = AppDbContextFactory.Create(_fixture.ConnectionString);

        Assert.True(await db.Database.CanConnectAsync());

        // sanity: a couple of expected tables resolve via EF metadata
        var entityTypes = db.Model.GetEntityTypes().Select(e => e.GetTableName()).ToHashSet();
        Assert.Contains("feature_flags", entityTypes);
        Assert.Contains("segments", entityTypes);
    }
}
