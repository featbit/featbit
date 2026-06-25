using Infrastructure.IntegrationTests.Fixtures;
using Npgsql;

namespace Infrastructure.IntegrationTests.Smoke;

[Collection(PostgresCollection.Name)]
public class PostgresFixtureSmokeTests : IntegrationTestBase
{
    private readonly PostgresFixture _fixture;

    public PostgresFixtureSmokeTests(PostgresFixture fixture)
    {
        _fixture = fixture;
    }

    [DockerFact]
    public async Task Fixture_ExecutesSelect1()
    {
        await using var connection = new NpgsqlConnection(_fixture.ConnectionString);
        await connection.OpenAsync();

        await using var cmd = new NpgsqlCommand("SELECT 1", connection);
        var result = await cmd.ExecuteScalarAsync();

        Assert.Equal(1, Convert.ToInt32(result));
    }
}
