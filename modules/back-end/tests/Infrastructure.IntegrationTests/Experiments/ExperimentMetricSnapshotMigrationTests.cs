using Infrastructure.IntegrationTests.Fixtures;
using Npgsql;

namespace Infrastructure.IntegrationTests.Experiments;

public class ExperimentMetricSnapshotMigrationTests(PostgresFixture fixture)
    : IntegrationTestBase, IClassFixture<PostgresFixture>
{
    [DockerFact]
    public async Task Migration_UpdatesEmptyTables_AndEnforcesColumnRequirements()
    {
        var database = $"snapshot_{Guid.NewGuid():N}";
        await using var bootstrap = new NpgsqlConnection(fixture.ConnectionString);
        await bootstrap.OpenAsync();
        await new NpgsqlCommand($"CREATE DATABASE {database}", bootstrap).ExecuteNonQueryAsync();
        await using var connection = new NpgsqlConnection(new NpgsqlConnectionStringBuilder(fixture.ConnectionString)
        {
            Database = database
        }.ToString());
        await connection.OpenAsync();
        await new NpgsqlCommand("""
            CREATE TABLE experiment_metrics (id uuid PRIMARY KEY);
            CREATE TABLE experiments (id uuid PRIMARY KEY, primary_metric text, guardrails text);
            CREATE TABLE experiment_runs (
                id uuid PRIMARY KEY, experiment_id uuid, primary_metric_event varchar(256), metric_description text,
                primary_metric_type varchar(64), primary_metric_agg varchar(64), guardrail_events text,
                guardrail_descriptions text, analysis_result text
            );
            """, connection).ExecuteNonQueryAsync();

        foreach (var resource in new[] { "ExperimentMetricEventName.sql", "ExperimentMetricSnapshots.sql" })
        {
            using var migration = new StreamReader(typeof(ExperimentMetricSnapshotMigrationTests).Assembly
                .GetManifestResourceStream(resource)!);
            await new NpgsqlCommand(await migration.ReadToEndAsync(), connection).ExecuteNonQueryAsync();
        }

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

        foreach (var table in new[] { "experiments", "experiment_runs" })
        {
            var id = Guid.NewGuid();
            Assert.Equal("[]", await new NpgsqlCommand(
                $"INSERT INTO {table} (id) VALUES ('{id}') RETURNING guardrail_metrics::text", connection).ExecuteScalarAsync());
            await new NpgsqlCommand($"UPDATE {table} SET primary_metric = '{{}}'::jsonb", connection).ExecuteNonQueryAsync();
            await AssertSqlStateAsync($"UPDATE {table} SET guardrail_metrics = NULL", PostgresErrorCodes.NotNullViolation);
        }

        await new NpgsqlCommand(
            $"INSERT INTO experiment_metrics (id, event_name) VALUES ('{Guid.NewGuid()}', repeat('测', 256))",
            connection).ExecuteNonQueryAsync();
        await AssertSqlStateAsync("UPDATE experiment_metrics SET event_name = repeat('测', 257)", PostgresErrorCodes.StringDataRightTruncation);
        await AssertSqlStateAsync("UPDATE experiment_metrics SET event_name = NULL", PostgresErrorCodes.NotNullViolation);

        async Task AssertSqlStateAsync(string sql, string sqlState)
        {
            var exception = await Assert.ThrowsAsync<PostgresException>(() =>
                new NpgsqlCommand(sql, connection).ExecuteNonQueryAsync());
            Assert.Equal(sqlState, exception.SqlState);
        }
    }
}
