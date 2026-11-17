using Domain.AuditLogs;
using Infrastructure.IntegrationTests.Fixtures;
using Infrastructure.Persistence.EntityFrameworkCore;
using Infrastructure.Services.EntityFrameworkCore;

namespace Infrastructure.IntegrationTests.Services.EntityFrameworkCore;

[Collection(FeatBitPostgresCollection.Name)]
public class AuditLogServiceTests(FeatBitPostgresFixture fixture) : IntegrationTestBase
{
    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Guid _envId = Guid.NewGuid();
    private readonly string _refId = Guid.NewGuid().ToString();
    private static readonly DateTime CreatedAt = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    private AppDbContext NewContext() => AppDbContextFactory.Create(fixture.ConnectionString);

    private AuditLog NewLog(string operation, DateTime timestamp) =>
        new(_workspaceId, null, _envId, _refId, AuditLogRefTypes.FeatureFlag,
            "audit-log-service-test", operation, new DataChange(), operation, Guid.NewGuid())
        {
            CreatedAt = timestamp
        };

    [DockerFact]
    public async Task GetLastChangesAsync_CreateOnly_ReturnsEmpty()
    {
        await using var db = NewContext();
        db.Add(NewLog(Operations.Create, CreatedAt));
        await db.SaveChangesAsync();

        var results = await new AuditLogService(db).GetLastChangesAsync(
            _workspaceId, _envId, AuditLogRefTypes.FeatureFlag, [_refId]);

        Assert.Empty(results);
    }

    [DockerFact]
    public async Task GetLastChangesAsync_CreateThenUpdate_ReturnsUpdate()
    {
        await using var db = NewContext();
        var update = NewLog(Operations.Update, CreatedAt.AddSeconds(1));
        db.AddRange(NewLog(Operations.Create, CreatedAt), update);
        await db.SaveChangesAsync();

        var results = await new AuditLogService(db).GetLastChangesAsync(
            _workspaceId, _envId, AuditLogRefTypes.FeatureFlag, [_refId]);

        var actual = Assert.Single(results);
        Assert.Equal(update.RefId, actual.RefId);
        Assert.Equal(update.CreatorId, actual.OperatorId);
        Assert.Equal(update.CreatedAt, actual.HappenedAt);
        Assert.Equal(update.Comment, actual.Comment);
    }
}
