using Infrastructure.IntegrationTests.Fixtures;
using Npgsql;

namespace Infrastructure.IntegrationTests.Experiments;

public class ExperimentMetricSnapshotMigrationTests(FeatBitPostgresFixture fixture)
    : IntegrationTestBase, IClassFixture<FeatBitPostgresFixture>
{
    [DockerFact]
    public async Task FixtureSchema_UsesTypedMetricColumns_AndEnforcesRequirements()
    {
        await using var connection = new NpgsqlConnection(fixture.ConnectionString);
        await connection.OpenAsync();

        Assert.Equal(4L, await new NpgsqlCommand("""
            SELECT count(*) FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name IN ('experiments', 'experiment_runs')
                AND column_name IN ('primary_metric', 'guardrail_metrics') AND data_type = 'jsonb'
            """, connection).ExecuteScalarAsync());
        Assert.Equal(0L, await new NpgsqlCommand("""
            SELECT count(*) FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'experiment_runs'
                AND column_name IN ('primary_metric_event', 'metric_description', 'guardrail_events', 'guardrail_descriptions',
                    'primary_metric_type', 'primary_metric_agg')
            """, connection).ExecuteScalarAsync());

        var experimentId = Guid.NewGuid();
        var runId = Guid.NewGuid();
        Assert.Equal("[]", await new NpgsqlCommand($"""
            INSERT INTO experiments (id, name, stage, created_at, updated_at)
            VALUES ('{experimentId}', 'Metric schema test', 'hypothesis', now(), now())
            RETURNING guardrail_metrics::text
            """, connection).ExecuteScalarAsync());
        Assert.Equal("[]", await new NpgsqlCommand($"""
            INSERT INTO experiment_runs (id, experiment_id, slug, prior_proper, created_at, updated_at)
            VALUES ('{runId}', '{experimentId}', 'run-1', false, now(), now())
            RETURNING guardrail_metrics::text
            """, connection).ExecuteScalarAsync());

        foreach (var (table, id) in new[] { ("experiments", experimentId), ("experiment_runs", runId) })
        {
            await new NpgsqlCommand($"UPDATE {table} SET primary_metric = '{{}}'::jsonb WHERE id = '{id}'", connection).ExecuteNonQueryAsync();
            await AssertSqlStateAsync($"UPDATE {table} SET guardrail_metrics = NULL WHERE id = '{id}'", PostgresErrorCodes.NotNullViolation);
        }

        var metricId = Guid.NewGuid();
        await new NpgsqlCommand($"""
            INSERT INTO experiment_metrics
                (id, env_id, name, key, event_name, metric_type, metric_agg, status, created_at, updated_at)
            VALUES ('{metricId}', '{Guid.NewGuid()}', 'Metric schema test', 'schema-test', repeat('测', 256),
                'binary', 'once', 'active', now(), now())
            """, connection).ExecuteNonQueryAsync();
        await AssertSqlStateAsync($"UPDATE experiment_metrics SET event_name = repeat('测', 257) WHERE id = '{metricId}'", PostgresErrorCodes.StringDataRightTruncation);
        await AssertSqlStateAsync($"UPDATE experiment_metrics SET event_name = NULL WHERE id = '{metricId}'", PostgresErrorCodes.NotNullViolation);

        async Task AssertSqlStateAsync(string sql, string sqlState)
        {
            var exception = await Assert.ThrowsAsync<PostgresException>(() =>
                new NpgsqlCommand(sql, connection).ExecuteNonQueryAsync());
            Assert.Equal(sqlState, exception.SqlState);
        }
    }
}
