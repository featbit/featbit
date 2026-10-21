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
        var originalPage = await service.GetListAsync(org.WorkspaceId, org.Id, env.Id, new AuditLogFilter { Scope = AuditLogScope.Environment });
        Assert.Equal(3, originalPage.TotalCount);
        Assert.All(originalPage.Items, x => { Assert.Equal(env.Id, x.EnvId); Assert.Equal(org.Id, x.OrganizationId); });
        var otherEnv = Guid.NewGuid();
        Assert.Empty((await service.GetListAsync(org.WorkspaceId, org.Id, otherEnv, new AuditLogFilter { Scope = AuditLogScope.Environment })).Items);
        var history = await service.GetListAsync(org.WorkspaceId, org.Id, otherEnv, new AuditLogFilter { Scope = AuditLogScope.Environment, CrossEnvironment = true, RefType = "Segment", RefId = segment.Id.ToString() });
        Assert.Equal(logs.Select(x => x.Id).Order(), history.Items.Select(x => x.Id).Order());
        Assert.Empty((await service.GetListAsync(Guid.NewGuid(), org.Id, env.Id, new AuditLogFilter { Scope = AuditLogScope.Environment, CrossEnvironment = true, RefId = segment.Id.ToString() })).Items);
    }

    [DockerFact]
    public async Task TestSchema_AppliesWithoutLocalMigration_AndIsRepeatable()
    {
        await using var connection = new NpgsqlConnection(fixture.ConnectionString);
        await connection.OpenAsync();
        var schema = "audit_schema_" + Guid.NewGuid().ToString("N");
        await using (var setup = new NpgsqlCommand($"""
            CREATE SCHEMA {schema};
            SET search_path TO {schema};
            CREATE TABLE feature_flags (id uuid);
            CREATE TABLE audit_logs (id uuid, env_id uuid NOT NULL, ref_type text, ref_id text, created_at timestamp);
            CREATE INDEX ix_audit_logs_env_id_ref_id_created_at ON audit_logs(env_id, ref_id, created_at);
            """, connection)) await setup.ExecuteNonQueryAsync();
        using var stream = typeof(SharedSegmentAuditTests).Assembly.GetManifestResourceStream("FeatBitPostgresInitDb.vNext.sql")!;
        using var reader = new StreamReader(stream);
        var sql = (await reader.ReadToEndAsync()).Replace("\\connect featbit", "");
        for (var run = 0; run < 2; run++)
        {
            await using var migrate = new NpgsqlCommand(sql, connection);
            await migrate.ExecuteNonQueryAsync();
        }
        await using var insert = new NpgsqlCommand("INSERT INTO audit_logs(id, workspace_id, organization_id, env_id) VALUES (@id, @workspace, @org, NULL)", connection);
        insert.Parameters.AddWithValue("id", Guid.NewGuid());
        insert.Parameters.AddWithValue("workspace", Guid.NewGuid());
        insert.Parameters.AddWithValue("org", Guid.NewGuid());
        Assert.Equal(1, await insert.ExecuteNonQueryAsync());
        await using var indexes = new NpgsqlCommand("SELECT count(*) FROM pg_indexes WHERE schemaname = @schema AND tablename = 'audit_logs'", connection);
        indexes.Parameters.AddWithValue("schema", schema);
        Assert.Equal(3L, await indexes.ExecuteScalarAsync());
    }
}
