using Domain.Bases;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace MongoToPostgresMigrator.Tests;

/// <summary>
/// Unit tests for <see cref="EntityStep{T}.SaveWithIsolationAsync"/> — the
/// binary-split path that keeps a chunk containing a constraint-violating row
/// (e.g. a string longer than a <c>varchar(128)</c> column, such as the
/// scanner-payload property names seen in production) from aborting the copy.
/// The bad row is isolated and skipped; every clean row is still saved. DB-free:
/// the save is a delegate that throws for poisoned rows, so the algorithm is
/// exercised without EF Core or PostgreSQL.
/// </summary>
public class SaveWithIsolationTests
{
    private sealed class FakeEntity : Entity;

    // Exposes the protected static isolation algorithm for testing.
    private sealed class TestableStep() : EntityStep<FakeEntity>("Fake")
    {
        public static Task<long> Isolate(
            FakeEntity[] chunk, Func<FakeEntity[], Task> saveAsync, Action<FakeEntity, Exception> onSkip) =>
            SaveWithIsolationAsync(chunk, saveAsync, onSkip);
    }

    /// <summary>
    /// A save that mimics an atomic batch insert: if any row in the batch is
    /// poisoned the whole batch throws (as a real INSERT would on a length
    /// violation); otherwise every row is recorded as saved. The thrown exception
    /// carries a <see cref="PostgresException"/> with SQLSTATE <c>22001</c>
    /// (string data right truncation), exactly as Npgsql surfaces the
    /// <c>varchar(128)</c> violation named in the class comment.
    /// </summary>
    private sealed class FakeSave(IReadOnlySet<Guid> poisoned)
    {
        public readonly HashSet<Guid> Saved = new();
        public int Calls { get; private set; }

        public Task SaveAsync(FakeEntity[] batch)
        {
            Calls++;
            if (batch.Any(e => poisoned.Contains(e.Id)))
            {
                throw DbUpdate("22001", "value too long for type character varying(128)");
            }

            foreach (var e in batch)
            {
                Saved.Add(e.Id);
            }

            return Task.CompletedTask;
        }
    }

    /// <summary>
    /// Builds the exception shape EF Core produces for a failed SaveChanges: a
    /// <see cref="DbUpdateException"/> wrapping the driver's
    /// <see cref="PostgresException"/>, which carries the SQLSTATE that decides
    /// whether the failure is attributable to the row or to the connection.
    /// </summary>
    private static DbUpdateException DbUpdate(string sqlState, string message) =>
        new(message, new PostgresException(message, "ERROR", "ERROR", sqlState));

    private static FakeEntity[] Rows(int count) =>
        Enumerable.Range(0, count).Select(_ => new FakeEntity { Id = Guid.NewGuid() }).ToArray();

    [Fact]
    public async Task EmptyChunk_SavesNothing()
    {
        var save = new FakeSave(new HashSet<Guid>());

        var written = await TestableStep.Isolate([], save.SaveAsync, (_, _) => { });

        Assert.Equal(0, written);
        Assert.Equal(0, save.Calls);
    }

    [Fact]
    public async Task CleanChunk_SavedInOneRoundTrip()
    {
        var rows = Rows(64);
        var save = new FakeSave(new HashSet<Guid>());

        var written = await TestableStep.Isolate(rows, save.SaveAsync, (_, _) => { });

        Assert.Equal(64, written);
        Assert.Equal(1, save.Calls);
        Assert.Equal(rows.Select(r => r.Id).ToHashSet(), save.Saved);
    }

    [Fact]
    public async Task SingleBadRow_IsSkipped_AndEveryCleanRowIsSaved()
    {
        var rows = Rows(64);
        var bad = rows[40];
        var save = new FakeSave(new HashSet<Guid> { bad.Id });
        var skipped = new List<FakeEntity>();

        var written = await TestableStep.Isolate(rows, save.SaveAsync, (r, _) => skipped.Add(r));

        Assert.Equal(63, written);
        Assert.Equal(bad.Id, Assert.Single(skipped).Id);
        Assert.DoesNotContain(bad.Id, save.Saved);
        Assert.Equal(63, save.Saved.Count);
    }

    [Fact]
    public async Task SingleBadRow_IsIsolatedInAboutLog2Steps_NotOneRowAtATime()
    {
        var rows = Rows(64);
        var save = new FakeSave(new HashSet<Guid> { rows[0].Id });

        await TestableStep.Isolate(rows, save.SaveAsync, (_, _) => { });

        // A one-row-at-a-time fallback would cost ~64 calls; binary-split isolates
        // a lone bad row in far fewer. Guard well under that to prove the split.
        Assert.True(save.Calls < 20, $"expected a binary-split (<20 calls) but took {save.Calls}");
    }

    [Fact]
    public async Task MultipleBadRows_AllSkipped_RestSaved()
    {
        var rows = Rows(100);
        var poisoned = new HashSet<Guid> { rows[3].Id, rows[50].Id, rows[99].Id };
        var save = new FakeSave(poisoned);
        var skipped = new List<FakeEntity>();

        var written = await TestableStep.Isolate(rows, save.SaveAsync, (r, _) => skipped.Add(r));

        Assert.Equal(97, written);
        Assert.Equal(poisoned, skipped.Select(r => r.Id).ToHashSet());
        Assert.Equal(97, save.Saved.Count);
        Assert.Empty(save.Saved.Intersect(poisoned));
    }

    [Fact]
    public async Task SkipCallback_ReceivesTheViolationReason()
    {
        var rows = Rows(2);
        var save = new FakeSave(new HashSet<Guid> { rows[1].Id });
        Exception? reason = null;

        await TestableStep.Isolate(rows, save.SaveAsync, (_, ex) => reason = ex);

        Assert.NotNull(reason);
        Assert.Contains("character varying(128)", reason!.Message);
    }

    [Fact]
    public async Task NonDbUpdateException_IsNotSwallowed()
    {
        var rows = Rows(8);
        Func<FakeEntity[], Task> save = _ => throw new InvalidOperationException("connection lost");

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => TestableStep.Isolate(rows, save, (_, _) => { }));
    }

    /// <summary>
    /// EF Core wraps infrastructure faults in the same <see cref="DbUpdateException"/>
    /// as constraint violations. Isolating one would binary-split down to single rows,
    /// fail identically on each, and record the entire chunk as "skipped" — which the
    /// verify pass accepts because it only checks <c>target == source - skipped</c>.
    /// The run would exit 0 having silently dropped the data, so these must propagate.
    /// </summary>
    [Theory]
    [InlineData("08006")] // connection_failure
    [InlineData("08003")] // connection_does_not_exist
    [InlineData("40001")] // serialization_failure
    [InlineData("40P01")] // deadlock_detected
    [InlineData("53100")] // disk_full
    [InlineData("57014")] // query_canceled (statement timeout)
    public async Task InfrastructureSqlState_Propagates_AndIsNeverSkipped(string sqlState)
    {
        var rows = Rows(8);
        var skipped = new List<FakeEntity>();
        Func<FakeEntity[], Task> save = _ =>
            throw new DbUpdateException(
                "transient failure", new PostgresException("transient failure", "ERROR", "ERROR", sqlState));

        var ex = await Assert.ThrowsAsync<DbUpdateException>(
            () => TestableStep.Isolate(rows, save, (r, _) => skipped.Add(r)));

        Assert.Equal(sqlState, Assert.IsType<PostgresException>(ex.InnerException).SqlState);
        Assert.Empty(skipped);
    }

    /// <summary>
    /// The row-attributable SQLSTATE classes: 22 (data exception) and 23 (integrity
    /// constraint violation). These are the failures a single bad source row causes,
    /// so they are isolated and skipped.
    /// </summary>
    [Theory]
    [InlineData("22001")] // string_data_right_truncation
    [InlineData("22007")] // invalid_datetime_format
    [InlineData("23505")] // unique_violation
    [InlineData("23502")] // not_null_violation
    public async Task RowAttributableSqlState_IsIsolatedAndSkipped(string sqlState)
    {
        var rows = Rows(8);
        var bad = rows[5];
        var skipped = new List<FakeEntity>();
        var saved = new HashSet<Guid>();

        Func<FakeEntity[], Task> save = batch =>
        {
            if (batch.Any(e => e.Id == bad.Id))
            {
                throw new DbUpdateException(
                    "bad row", new PostgresException("bad row", "ERROR", "ERROR", sqlState));
            }

            foreach (var e in batch)
            {
                saved.Add(e.Id);
            }

            return Task.CompletedTask;
        };

        var written = await TestableStep.Isolate(rows, save, (r, _) => skipped.Add(r));

        Assert.Equal(7, written);
        Assert.Equal(bad.Id, Assert.Single(skipped).Id);
        Assert.DoesNotContain(bad.Id, saved);
    }

    /// <summary>
    /// A nested driver exception must still be classified — EF can wrap the
    /// Npgsql exception more than one level deep.
    /// </summary>
    [Fact]
    public async Task NestedInfrastructureSqlState_Propagates()
    {
        var rows = Rows(4);
        Func<FakeEntity[], Task> save = _ =>
            throw new DbUpdateException(
                "save failed",
                new InvalidOperationException(
                    "inner", new PostgresException("connection lost", "FATAL", "FATAL", "08006")));

        await Assert.ThrowsAsync<DbUpdateException>(
            () => TestableStep.Isolate(rows, save, (_, _) => { }));
    }

    /// <summary>
    /// Npgsql reports network and protocol failures as a plain
    /// <see cref="NpgsqlException"/> — not a <see cref="PostgresException"/> — so
    /// there is no server SQLSTATE to inspect. Absence of diagnostics is not
    /// evidence that one row is bad, so the failure must propagate rather than be
    /// isolated. Skipping here would drop the whole chunk while still satisfying
    /// the verify arithmetic.
    /// </summary>
    [Fact]
    public async Task NpgsqlExceptionWithoutSqlState_Propagates_AndIsNeverSkipped()
    {
        var rows = Rows(8);
        var skipped = new List<FakeEntity>();
        Func<FakeEntity[], Task> save = _ =>
            throw new DbUpdateException(
                "An exception occurred while writing to the database.",
                new NpgsqlException("Exception while reading from stream"));

        await Assert.ThrowsAsync<DbUpdateException>(
            () => TestableStep.Isolate(rows, save, (r, _) => skipped.Add(r)));

        Assert.Empty(skipped);
    }

    /// <summary>
    /// The same rule for any other diagnostics-free inner exception (a socket
    /// timeout, an I/O error) and for a bare <see cref="DbUpdateException"/>.
    /// </summary>
    [Theory]
    [InlineData(typeof(TimeoutException))]
    [InlineData(typeof(IOException))]
    [InlineData(null)]
    public async Task DbUpdateExceptionWithoutPostgresDiagnostics_Propagates(Type? innerType)
    {
        var rows = Rows(8);
        var skipped = new List<FakeEntity>();
        var inner = innerType is null ? null : (Exception)Activator.CreateInstance(innerType)!;
        Func<FakeEntity[], Task> save = _ =>
            throw (inner is null
                ? new DbUpdateException("save failed")
                : new DbUpdateException("save failed", inner));

        await Assert.ThrowsAsync<DbUpdateException>(
            () => TestableStep.Isolate(rows, save, (r, _) => skipped.Add(r)));

        Assert.Empty(skipped);
    }
}
