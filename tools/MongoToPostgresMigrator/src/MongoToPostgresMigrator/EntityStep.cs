using System.Threading.Channels;
using Domain.Bases;
using Infrastructure.Persistence.EntityFrameworkCore;
using Infrastructure.Persistence.MongoDb;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using MongoDB.Bson;
using MongoDB.Bson.Serialization;
using MongoDB.Driver;
using Npgsql;

namespace MongoToPostgresMigrator;

/// <summary>
/// Shared services the entity steps operate against.
/// </summary>
public sealed class MigrationContext(
    MongoDbClient mongo,
    AppDbContext db,
    NpgsqlDataSource dataSource,
    int batchSize,
    ILogger logger)
{
    private readonly Dictionary<string, int> _skippedByEntity = new();

    public MongoDbClient Mongo { get; } = mongo;
    public AppDbContext Db { get; } = db;

    /// <summary>
    /// The application's own <see cref="NpgsqlDataSource"/> (configured with
    /// <c>EnableDynamicJson()</c> and the app's JSON options). High-volume steps
    /// use it for a raw binary <c>COPY</c> that writes jsonb and timestamptz
    /// byte-identically to the EF Core path.
    /// </summary>
    public NpgsqlDataSource DataSource { get; } = dataSource;

    public int BatchSize { get; } = batchSize;
    public ILogger Logger { get; } = logger;

    /// <summary>
    /// Count of source documents whose <c>_id</c> was not a UUID and was given a
    /// fresh <see cref="Guid"/> during the copy. Surfaced in the run summary.
    /// </summary>
    public int ReassignedIds { get; set; }

    /// <summary>
    /// Rows skipped because they violated a target constraint (e.g. a value
    /// longer than the column allows), keyed by entity name.
    /// </summary>
    public IReadOnlyDictionary<string, int> SkippedByEntity => _skippedByEntity;

    public int TotalSkipped => _skippedByEntity.Values.Sum();

    public int SkippedFor(string entity) => _skippedByEntity.GetValueOrDefault(entity);

    /// <summary>
    /// Records that a single row could not be written to PostgreSQL and was
    /// skipped, logging enough to audit which row and why.
    /// </summary>
    public void RecordSkip(string entity, Guid id, Exception ex)
    {
        _skippedByEntity[entity] = _skippedByEntity.GetValueOrDefault(entity) + 1;
        Logger.LogWarning(
            "{Entity}: skipped row id {Id} — {Reason}",
            entity, id, ex.InnerException?.Message ?? ex.Message);
    }

    /// <summary>
    /// Records that a group of rows was skipped as a whole (for example, the
    /// duplicate <c>(env_id, key_id)</c> rows collapsed by an in-database
    /// <c>ON CONFLICT DO NOTHING</c> merge). Logs a single line with the count
    /// instead of one line per row so a large dirty-data class stays auditable
    /// without flooding the log.
    /// </summary>
    public void RecordBulkSkip(string entity, int count, string reason)
    {
        if (count <= 0)
        {
            return;
        }

        _skippedByEntity[entity] = _skippedByEntity.GetValueOrDefault(entity) + count;
        Logger.LogWarning("{Entity}: skipped {Count} row(s) — {Reason}", entity, count, reason);
    }
}

/// <summary>
/// A single entity's migration behaviour: copy, count source, count target.
/// The type list is declared exactly once (see <see cref="MigrationPipeline"/>);
/// preflight, migrate, and verify all reuse the same steps.
/// </summary>
public interface IEntityStep
{
    string Name { get; }

    Task<long> CopyAsync(MigrationContext ctx);

    Task<long> CountSourceAsync(MigrationContext ctx);

    Task<long> CountTargetAsync(MigrationContext ctx);
}

/// <summary>
/// Generic entity step. Reads a MongoDB collection into the shared domain POCO
/// and writes the same object through EF Core, inheriting every type conversion
/// (snake_case, jsonb, text[]) from the application's own persistence config.
/// </summary>
public class EntityStep<T>(string name) : IEntityStep where T : Entity
{
    public string Name { get; } = name;

    public virtual async Task<long> CopyAsync(MigrationContext ctx)
    {
        long n = 0;
        var buffer = new List<T>(ctx.BatchSize);

        await foreach (var entity in ReadEntitiesAsync(ctx))
        {
            buffer.Add(entity);
            if (buffer.Count >= ctx.BatchSize)
            {
                n += await SaveChunkAsync(ctx, buffer.ToArray());
                buffer.Clear();
            }
        }

        if (buffer.Count > 0)
        {
            n += await SaveChunkAsync(ctx, buffer.ToArray());
        }

        ctx.Logger.LogInformation("{Entity}: migrated {Count}", Name, n);
        return n;
    }

    /// <summary>
    /// Streams the source collection as domain POCOs, one at a time. Reads raw
    /// <see cref="BsonDocument"/>s (not the typed collection) so a document whose
    /// <c>_id</c> is not a UUID doesn't abort the whole cursor during
    /// deserialization: each <c>_id</c> is repaired (see
    /// <see cref="RepairNonUuidId"/>) before the document is deserialized with the
    /// application's own class maps. The cursor is streamed so high-volume
    /// collections never load fully into memory. Shared by the EF Core path here
    /// and the binary-COPY steps.
    /// </summary>
    protected async IAsyncEnumerable<T> ReadEntitiesAsync(MigrationContext ctx)
    {
        var collectionName = ctx.Mongo.CollectionNameOf<T>();
        var raw = ctx.Mongo.CollectionOf(collectionName);

        using var cursor = await raw.FindAsync(FilterDefinition<BsonDocument>.Empty);
        while (await cursor.MoveNextAsync())
        {
            foreach (var doc in cursor.Current)
            {
                RepairNonUuidId(ctx, doc);
                yield return BsonSerializer.Deserialize<T>(doc);
            }
        }
    }

    /// <summary>
    /// <see cref="ReadEntitiesAsync"/> with the MongoDB read running concurrently
    /// with whatever consumes it.
    /// <para>
    /// Consumed directly, <see cref="ReadEntitiesAsync"/> interleaves strictly
    /// with the caller: the reader blocks while a block is written, then the
    /// writer blocks while the next MongoDB batch (up to 16 MB per round trip) is
    /// fetched. On a local database both waits are negligible, but across a WAN
    /// they dominate, and the run costs the <em>sum</em> of read and write time —
    /// visible as bursts of fast COPYs separated by stalls. Reading through a
    /// bounded channel lets the next fetch be in flight while the current rows are
    /// written, so the run costs roughly the slower side instead of the sum.
    /// </para>
    /// <para>
    /// The channel is bounded and the producer waits when it is full, so at most
    /// <paramref name="capacity"/> entities are buffered no matter how far ahead
    /// the reader gets. That bound matters for wide documents (a
    /// <c>FlagRevision</c> embeds an entire feature flag). A producer failure is
    /// rethrown to the consumer on its next read, preserving fail-fast.
    /// </para>
    /// </summary>
    protected async IAsyncEnumerable<T> ReadEntitiesPrefetchedAsync(
        MigrationContext ctx, int capacity = DefaultPrefetchCapacity)
    {
        var channel = Channel.CreateBounded<T>(new BoundedChannelOptions(capacity)
        {
            SingleReader = true,
            SingleWriter = true,
            FullMode = BoundedChannelFullMode.Wait
        });

        var producer = Task.Run(async () =>
        {
            try
            {
                await foreach (var entity in ReadEntitiesAsync(ctx))
                {
                    await channel.Writer.WriteAsync(entity);
                }

                channel.Writer.Complete();
            }
            catch (Exception ex)
            {
                channel.Writer.Complete(ex);
            }
        });

        await foreach (var entity in channel.Reader.ReadAllAsync())
        {
            yield return entity;
        }

        // Observes a producer fault that surfaced after the channel drained.
        await producer;
    }

    /// <summary>
    /// Default number of entities buffered ahead of the writer. Sized to hold
    /// roughly two MongoDB server batches (16 MB each) so the reader can stay a
    /// full batch ahead while still bounding memory for wide documents.
    /// </summary>
    protected const int DefaultPrefetchCapacity = 20_000;

    /// <summary>
    /// Saves a chunk in a single round-trip. If the chunk violates a target
    /// constraint, isolates the offending row(s) by <b>binary-splitting</b> the
    /// chunk and retrying each half, recursing only into halves that still fail.
    /// A lone bad row is isolated in ~log2(chunk) steps instead of degrading the
    /// whole chunk to one-row-at-a-time inserts, so sparse dirty rows cost almost
    /// nothing. A single row that still fails is skipped (and logged). Returns the
    /// number of rows successfully written.
    /// </summary>
    protected Task<long> SaveChunkAsync(MigrationContext ctx, T[] chunk) =>
        SaveWithIsolationAsync(
            chunk,
            async batch =>
            {
                try
                {
                    ctx.Db.Set<T>().AddRange(batch);
                    await ctx.Db.SaveChangesAsync();
                }
                finally
                {
                    // Clear the change tracker after every save — on success so
                    // neither side accumulates memory, and on failure so the
                    // rolled-back (Added) entities are not re-saved on the retry.
                    ctx.Db.ChangeTracker.Clear();
                }
            },
            (row, ex) => ctx.RecordSkip(Name, row.Id, ex));

    /// <summary>
    /// The binary-split isolation algorithm behind <see cref="SaveChunkAsync"/>,
    /// separated from EF Core so it can be exercised without a database. Attempts
    /// to save the whole chunk via <paramref name="saveAsync"/> in one round-trip;
    /// if that throws a <see cref="DbUpdateException"/> caused by a bad row (see
    /// <see cref="IsBadRowFailure"/> — e.g. a value longer than the column allows),
    /// the chunk is split in half and each half retried, recursing only into halves
    /// that still fail. A lone row that still fails is skipped via
    /// <paramref name="onSkip"/> and excluded from the returned count. So a sparse
    /// bad row is isolated in ~log2(chunk) steps instead of degrading the whole
    /// chunk to one-row-at-a-time inserts. Returns the number of rows saved.
    /// <para>
    /// A <see cref="DbUpdateException"/> that is <i>not</i> attributable to the row
    /// data (a dropped connection, a lock timeout, an out-of-disk server) is
    /// rethrown so the run aborts. Treating those as skips would silently drop every
    /// row of the chunk while still satisfying the verify arithmetic
    /// (<c>target == source - skipped</c>), turning data loss into a clean exit 0.
    /// </para>
    /// </summary>
    protected static async Task<long> SaveWithIsolationAsync(
        T[] chunk, Func<T[], Task> saveAsync, Action<T, Exception> onSkip)
    {
        if (chunk.Length == 0)
        {
            return 0;
        }

        try
        {
            await saveAsync(chunk);
            return chunk.Length;
        }
        catch (DbUpdateException ex) when (IsBadRowFailure(ex))
        {
            if (chunk.Length == 1)
            {
                onSkip(chunk[0], ex);
                return 0;
            }

            var mid = chunk.Length / 2;
            var written = await SaveWithIsolationAsync(chunk[..mid], saveAsync, onSkip);
            written += await SaveWithIsolationAsync(chunk[mid..], saveAsync, onSkip);
            return written;
        }
    }

    /// <summary>
    /// True when a <see cref="DbUpdateException"/> is attributable to the row being
    /// written rather than to the connection or the server, i.e. when it is safe to
    /// isolate and skip the offending row.
    /// <para>
    /// The decision is made on the PostgreSQL SQLSTATE, not on the exception type:
    /// EF Core wraps infrastructure faults in the same <see cref="DbUpdateException"/>.
    /// Class <c>22</c> (data exception — e.g. <c>22001</c> string data right
    /// truncation) and class <c>23</c> (integrity constraint violation — e.g.
    /// <c>23505</c> unique violation) are the row-attributable classes. Anything
    /// else — class <c>08</c> connection exception, <c>40</c> transaction rollback /
    /// deadlock, <c>53</c> insufficient resources, <c>57</c> operator intervention —
    /// affects the whole batch and must abort the run.
    /// </para>
    /// <para>
    /// The default is <b>deny</b>: with no <see cref="PostgresException"/> in the
    /// chain there is no server SQLSTATE, and therefore no evidence that a specific
    /// row is at fault. Npgsql reports network and protocol failures as a plain
    /// <see cref="NpgsqlException"/> (or an <see cref="IOException"/> /
    /// <see cref="TimeoutException"/>), so treating "no diagnostics" as a bad row
    /// would reopen exactly the silent-data-loss path this method exists to close.
    /// Such failures propagate and abort the run.
    /// </para>
    /// </summary>
    internal static bool IsBadRowFailure(DbUpdateException ex)
    {
        // Walk the chain: EF may nest the driver exception more than one level deep.
        for (Exception? inner = ex.InnerException; inner is not null; inner = inner.InnerException)
        {
            if (inner is PostgresException pg)
            {
                var sqlStateClass = pg.SqlState.Length >= 2 ? pg.SqlState[..2] : pg.SqlState;
                return sqlStateClass is "22" or "23";
            }
        }

        return false;
    }

    /// <summary>
    /// FeatBit domain entities always key on a <see cref="Guid"/> (stored as a
    /// BSON UUID). If a source document's <c>_id</c> is anything else (e.g. a
    /// stray <c>ObjectId</c>), assign a fresh <see cref="Guid"/> so the row can be
    /// written to PostgreSQL's uuid primary key. The surrogate id is not a
    /// foreign-key target, so regenerating it preserves the row and its
    /// relationships. Each reassignment is logged for audit.
    /// </summary>
    protected void RepairNonUuidId(MigrationContext ctx, BsonDocument doc)
    {
        if (!doc.TryGetValue("_id", out var id))
        {
            return;
        }

        var isUuid = id.BsonType == BsonType.Binary &&
                     id.AsBsonBinaryData.SubType is BsonBinarySubType.UuidStandard
                         or BsonBinarySubType.UuidLegacy;
        if (isUuid)
        {
            return;
        }

        var newId = Guid.NewGuid();
        ctx.Logger.LogWarning(
            "{Entity}: source _id '{OldId}' is a {Type}, not a UUID; reassigned new id {NewId}.",
            Name, id.ToString(), id.BsonType, newId);

        doc["_id"] = new BsonBinaryData(newId, GuidRepresentation.Standard);
        ctx.ReassignedIds++;
    }

    public Task<long> CountSourceAsync(MigrationContext ctx) =>
        ctx.Mongo.CollectionOf<T>().CountDocumentsAsync(FilterDefinition<T>.Empty);

    public Task<long> CountTargetAsync(MigrationContext ctx) =>
        ctx.Db.Set<T>().LongCountAsync();
}
