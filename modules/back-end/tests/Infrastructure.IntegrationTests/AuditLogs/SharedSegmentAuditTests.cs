using Application.AuditLogs;
using Application.Services;
using Domain.AuditLogs;
using Domain.Organizations;
using Domain.Projects;
using Domain.Segments;
using Infrastructure.IntegrationTests.Fixtures;
using Infrastructure.IntegrationTests.Support;
using Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Moq;
using Npgsql;
using Environment = Domain.Environments.Environment;

namespace Infrastructure.IntegrationTests.AuditLogs;

[Collection(FeatBitPostgresCollection.Name)]
public class SharedSegmentAuditTests(FeatBitPostgresFixture fixture) : IntegrationTestBase
{
    [DockerFact]
    public async Task Writes_PreserveOriginalEnvironment_WithoutLosingCrossEnvironmentHistory()
    {
        await using var db = AppDbContextFactory.Create(fixture.ConnectionString);
        var org = new Organization(Guid.NewGuid(), "Audit", "audit") { Id = Guid.NewGuid() };
        var project = new Project(org.Id, "Project", "project") { Id = Guid.NewGuid() };
        var env = new Environment(project.Id, "Origin", "origin");
        var environments = new Mock<IEnvironmentService>();
        environments.Setup(x => x.GetAsync(env.Id)).ReturnsAsync(env);
        var projects = new Mock<IProjectService>();
        projects.Setup(x => x.GetAsync(project.Id)).ReturnsAsync(project);
        var organizations = new Mock<IOrganizationService>();
        organizations.Setup(x => x.GetAsync(org.Id)).ReturnsAsync(org);
        var service = new Infrastructure.Services.EntityFrameworkCore.AuditLogService(db,
            new AuditLogEnricher(environments.Object, projects.Object, organizations.Object));
        var segment = new Segment(org.WorkspaceId, env.Id, "Shared", "shared", SegmentType.Shared, [], [], [], [], "")
            { Id = Guid.NewGuid() };
        var logs = new[]
        {
            AuditLog.For(segment, Operations.Create, new DataChange(null).To(segment), "", Guid.NewGuid()),
            AuditLog.For(segment, Operations.Update, new DataChange(segment).To(segment), "changed", Guid.NewGuid()),
            AuditLog.For(segment, Operations.Remove, new DataChange(segment).To(null), "deleted", Guid.NewGuid())
        };
        await service.AddManyAsync(logs);
        var originalPage = await service.GetListAsync(org.WorkspaceId, org.Id, new AuditLogFilter { Scope = AuditLogScope.Environment, EnvId = env.Id });
        Assert.Equal(3, originalPage.TotalCount);
        Assert.All(originalPage.Items, x => { Assert.Equal(env.Id, x.EnvId); Assert.Equal(org.Id, x.OrganizationId); });
        var otherEnv = Guid.NewGuid();
        Assert.Empty((await service.GetListAsync(org.WorkspaceId, org.Id, new AuditLogFilter { Scope = AuditLogScope.Environment, EnvId = otherEnv })).Items);
        var history = await service.GetListAsync(org.WorkspaceId, org.Id, new AuditLogFilter { Scope = AuditLogScope.Environment, EnvId = otherEnv, CrossEnvironment = true, RefType = "Segment", RefId = segment.Id.ToString() });
        Assert.Equal(logs.Select(x => x.Id).Order(), history.Items.Select(x => x.Id).Order());
        Assert.Empty((await service.GetListAsync(Guid.NewGuid(), org.Id, new AuditLogFilter { Scope = AuditLogScope.Environment, EnvId = env.Id, CrossEnvironment = true, RefId = segment.Id.ToString() })).Items);
    }

    [DockerFact]
    public async Task Migration_PreservesSharedHistoryEnvironment_AndRecoversPreviouslyClearedIds()
    {
        await using var connection = new NpgsqlConnection(fixture.ConnectionString);
        await connection.OpenAsync();
        var schema = "audit_migration_" + Guid.NewGuid().ToString("N");
        await using (var setup = new NpgsqlCommand($"""
            CREATE SCHEMA {schema};
            SET search_path TO {schema};
            CREATE TABLE organizations (id uuid, workspace_id uuid);
            CREATE TABLE projects (id uuid, organization_id uuid);
            CREATE TABLE environments (id uuid, project_id uuid);
            CREATE TABLE audit_logs (id uuid, env_id uuid NOT NULL, ref_type text, ref_id text, data_change jsonb, created_at timestamp);
            """, connection)) await setup.ExecuteNonQueryAsync();
        var workspace = Guid.NewGuid(); var org = Guid.NewGuid(); var project = Guid.NewGuid(); var env = Guid.NewGuid();
        var segment = new Segment(workspace, env, "Shared", "shared", SegmentType.Shared, [], [], [], [], "");
        foreach (var deleted in new[] { false, true })
        {
            var change = deleted ? new DataChange(segment).To(null) : new DataChange(null).To(segment);
            var json = System.Text.Json.JsonSerializer.Serialize(change, new System.Text.Json.JsonSerializerOptions(System.Text.Json.JsonSerializerDefaults.Web));
            await using var insert = new NpgsqlCommand("INSERT INTO audit_logs VALUES (@id, @env, 'Segment', 'shared', @change::jsonb, now())", connection);
            insert.Parameters.AddWithValue("id", Guid.NewGuid()); insert.Parameters.AddWithValue("env", env);
            insert.Parameters.AddWithValue("change", json);
            await insert.ExecuteNonQueryAsync();
        }
        // Existing environment ownership must not depend on readable snapshot JSON.
        await using (var legacy = new NpgsqlCommand(
            """INSERT INTO audit_logs VALUES (@id, @env, 'Segment', 'legacy', '{"current":"not JSON"}'::jsonb, now())""", connection))
        {
            legacy.Parameters.AddWithValue("id", Guid.NewGuid());
            legacy.Parameters.AddWithValue("env", env);
            await legacy.ExecuteNonQueryAsync();
        }
        await using (var parents = new NpgsqlCommand("INSERT INTO organizations VALUES (@org,@ws); INSERT INTO projects VALUES (@project,@org); INSERT INTO environments VALUES (@env,@project)", connection))
        {
            parents.Parameters.AddWithValue("org", org); parents.Parameters.AddWithValue("ws", workspace);
            parents.Parameters.AddWithValue("project", project); parents.Parameters.AddWithValue("env", env);
            await parents.ExecuteNonQueryAsync();
        }
        using var stream = typeof(SharedSegmentAuditTests).Assembly.GetManifestResourceStream("FeatBitPostgresInitDb.v6.0.1.sql")!;
        using var reader = new StreamReader(stream);
        var migration = (await reader.ReadToEndAsync()).Replace("\\connect featbit", "");
        for (var run = 0; run < 2; run++)
        {
            await using (var migrate = new NpgsqlCommand(migration, connection)) await migrate.ExecuteNonQueryAsync();
            await using (var verify = new NpgsqlCommand("SELECT count(*) FROM audit_logs WHERE env_id=@env AND workspace_id=@ws AND organization_id=@org", connection))
            {
                verify.Parameters.AddWithValue("env", env); verify.Parameters.AddWithValue("ws", workspace); verify.Parameters.AddWithValue("org", org);
                Assert.Equal(3L, await verify.ExecuteScalarAsync());
            }
            if (run == 0)
            {
                await using var clear = new NpgsqlCommand("UPDATE audit_logs SET env_id=NULL, organization_id=NULL WHERE ref_id='shared'", connection);
                await clear.ExecuteNonQueryAsync();
            }
        }
    }
}
