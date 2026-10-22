using Infrastructure.IntegrationTests.Fixtures;
using Infrastructure.IntegrationTests.Support;
using Npgsql;

namespace Infrastructure.IntegrationTests.AuditLogs;

[Collection(FeatBitPostgresCollection.Name)]
public class AuditOwnershipMigrationTests(FeatBitPostgresFixture fixture) : IntegrationTestBase
{
    private static async Task Execute(NpgsqlConnection connection, string sql)
    {
        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync();
    }

    private static async Task<string> Migration()
    {
        using var stream = typeof(AuditOwnershipMigrationTests).Assembly
            .GetManifestResourceStream("FeatBitPostgresInitDb.v6.1.0.sql")!;
        using var reader = new StreamReader(stream);
        return (await reader.ReadToEndAsync()).Replace("\\connect featbit", "");
    }

    [DockerTheory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task BackfillsLegacyRows_PreservesExplicitOwnership_AndCanRunTwice(bool existingColumns)
    {
        await using var connection = new NpgsqlConnection(fixture.ConnectionString);
        await connection.OpenAsync();
        var schema = "migration_" + Guid.NewGuid().ToString("N");
        await CreateSchema(connection, schema, existingColumns);
        var sql = await Migration();
        await Execute(connection, sql);
        await Execute(connection, sql);
        await using var command = new NpgsqlCommand("""
            SELECT count(*) = 2 AND bool_and(workspace_id = '00000000-0000-0000-0000-000000000001'::uuid
                AND organization_id = '00000000-0000-0000-0000-000000000002'::uuid)
            FROM audit_logs WHERE ref_id = 'legacy'
            """, connection);
        Assert.Equal(true, await command.ExecuteScalarAsync());
        await using var constraint = new NpgsqlCommand($"""
            SELECT is_nullable FROM information_schema.columns
            WHERE table_schema = '{schema}' AND table_name = 'audit_logs' AND column_name = 'workspace_id'
            """, connection);
        Assert.Equal("NO", await constraint.ExecuteScalarAsync());
        if (existingColumns)
        {
            await using var explicitOwner = new NpgsqlCommand("""
                SELECT organization_id IS NULL AND workspace_id = '00000000-0000-0000-0000-000000000009'::uuid
                FROM audit_logs WHERE ref_id = 'explicit'
                """, connection);
            Assert.Equal(true, await explicitOwner.ExecuteScalarAsync());
        }
    }

    [DockerFact]
    public async Task UnresolvedOwnership_RollsBackIamSchemaAndKeepsHistory()
    {
        await using var connection = new NpgsqlConnection(fixture.ConnectionString);
        await connection.OpenAsync();
        var schema = "migration_" + Guid.NewGuid().ToString("N");
        await CreateSchema(connection, schema, false);
        await Execute(connection, "INSERT INTO audit_logs(id, env_id, ref_type, ref_id) VALUES (gen_random_uuid(), gen_random_uuid(), 'FeatureFlag', 'orphan')");
        var sql = await Migration();
        var error = await Assert.ThrowsAsync<PostgresException>(() => Execute(connection, sql));
        Assert.Contains("unresolved workspace ownership", error.MessageText);
        await Execute(connection, "ROLLBACK");
        await using var count = new NpgsqlCommand("SELECT count(*) FROM audit_logs", connection);
        Assert.Equal(3L, await count.ExecuteScalarAsync());
        await using var columns = new NpgsqlCommand($"""
            SELECT count(*) FROM information_schema.columns WHERE table_schema = '{schema}'
            AND table_name = 'audit_logs' AND column_name = 'workspace_id'
            """, connection);
        Assert.Equal(0L, await columns.ExecuteScalarAsync());
    }

    private static async Task CreateSchema(NpgsqlConnection connection, string schema, bool existingColumns)
    {
        await Execute(connection, $"""
            CREATE SCHEMA {schema};
            SET search_path TO {schema};
            CREATE TABLE feature_flags (id uuid);
            CREATE TABLE policies (type text, organization_id uuid, name text, statements jsonb);
            CREATE TABLE access_tokens (type text, permissions jsonb);
            CREATE TABLE organizations (id uuid, workspace_id uuid);
            CREATE TABLE projects (id uuid, organization_id uuid);
            CREATE TABLE environments (id uuid, project_id uuid);
            CREATE TABLE audit_logs (id uuid, env_id uuid, ref_type text, ref_id text, created_at timestamp, data_change jsonb);
            INSERT INTO organizations VALUES ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001');
            INSERT INTO projects VALUES ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002');
            INSERT INTO environments VALUES ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000003');
            INSERT INTO audit_logs VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000004', 'FeatureFlag', 'legacy', now(), NULL);
            INSERT INTO audit_logs VALUES (gen_random_uuid(), NULL, 'Segment', 'legacy', now(),
                jsonb_build_object('previous', jsonb_build_object('type', 'shared', 'envId', '00000000-0000-0000-0000-000000000004')::text, 'current', ''));
            """);
        if (existingColumns)
        {
            await Execute(connection, """
                ALTER TABLE audit_logs ADD COLUMN workspace_id uuid, ADD COLUMN organization_id uuid;
                INSERT INTO audit_logs(id, env_id, ref_type, ref_id, workspace_id) VALUES
                (gen_random_uuid(), '00000000-0000-0000-0000-000000000004', 'Segment', 'explicit', '00000000-0000-0000-0000-000000000009');
                """);
        }
    }
}
