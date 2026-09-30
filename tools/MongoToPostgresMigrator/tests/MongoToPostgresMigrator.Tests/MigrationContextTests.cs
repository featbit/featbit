using Microsoft.Extensions.Logging.Abstractions;

namespace MongoToPostgresMigrator.Tests;

/// <summary>
/// Unit tests for <see cref="MigrationContext"/>'s skip accounting — the numbers
/// the verify pass relies on (<c>target = source − skipped</c>). DB-free: the
/// Mongo/EF/data-source dependencies are never touched by these code paths.
/// </summary>
public class MigrationContextTests
{
    private static MigrationContext CreateSut() =>
        new(mongo: null!, db: null!, dataSource: null!, batchSize: 0, logger: NullLogger.Instance);

    [Fact]
    public void SkippedFor_UnknownEntity_ReturnsZero()
    {
        var sut = CreateSut();

        Assert.Equal(0, sut.SkippedFor("Users"));
        Assert.Equal(0, sut.TotalSkipped);
    }

    [Fact]
    public void RecordSkip_IncrementsPerEntityAndTotal()
    {
        var sut = CreateSut();

        sut.RecordSkip("Users", Guid.NewGuid(), new Exception("bad row"));
        sut.RecordSkip("Users", Guid.NewGuid(), new Exception("bad row"));

        Assert.Equal(2, sut.SkippedFor("Users"));
        Assert.Equal(2, sut.TotalSkipped);
    }

    [Fact]
    public void RecordSkip_TracksEntitiesIndependently()
    {
        var sut = CreateSut();

        sut.RecordSkip("Users", Guid.NewGuid(), new Exception());
        sut.RecordSkip("AuditLogs", Guid.NewGuid(), new Exception());
        sut.RecordSkip("AuditLogs", Guid.NewGuid(), new Exception());

        Assert.Equal(1, sut.SkippedFor("Users"));
        Assert.Equal(2, sut.SkippedFor("AuditLogs"));
        Assert.Equal(3, sut.TotalSkipped);
    }

    [Fact]
    public void RecordBulkSkip_AddsCount()
    {
        var sut = CreateSut();

        sut.RecordBulkSkip("EndUsers", 10_979, "duplicate (env_id, key_id)");

        Assert.Equal(10_979, sut.SkippedFor("EndUsers"));
        Assert.Equal(10_979, sut.TotalSkipped);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void RecordBulkSkip_NonPositiveCount_IsNoOp(int count)
    {
        var sut = CreateSut();

        sut.RecordBulkSkip("EndUsers", count, "nothing collapsed");

        Assert.Equal(0, sut.SkippedFor("EndUsers"));
        Assert.Empty(sut.SkippedByEntity);
    }

    [Fact]
    public void Skips_SingleAndBulk_AggregateForSameEntity()
    {
        var sut = CreateSut();

        sut.RecordSkip("EndUsers", Guid.NewGuid(), new Exception());
        sut.RecordBulkSkip("EndUsers", 5, "duplicates");

        Assert.Equal(6, sut.SkippedFor("EndUsers"));
        Assert.Equal(6, sut.TotalSkipped);
    }
}
