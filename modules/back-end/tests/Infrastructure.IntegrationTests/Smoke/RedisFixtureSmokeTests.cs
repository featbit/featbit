using Infrastructure.IntegrationTests.Fixtures;
using StackExchange.Redis;

namespace Infrastructure.IntegrationTests.Smoke;

[Collection(RedisCollection.Name)]
public class RedisFixtureSmokeTests : IntegrationTestBase
{
    private readonly RedisFixture _fixture;

    public RedisFixtureSmokeTests(RedisFixture fixture)
    {
        _fixture = fixture;
    }

    [DockerFact]
    public async Task Fixture_RespondsToPing()
    {
        using var connection = await ConnectionMultiplexer.ConnectAsync(_fixture.ConnectionString);

        var latency = await connection.GetDatabase().PingAsync();

        Assert.True(latency >= TimeSpan.Zero);
    }
}
