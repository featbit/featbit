using Domain.EndUsers;
using Microsoft.Extensions.Logging;
using Npgsql;
using NpgsqlTypes;

namespace MongoToPostgresMigrator;

/// <summary>
/// High-throughput migration for <c>end_users</c>, the table that dominates
/// runtime at production scale (tens of millions of rows). Instead of writing
/// through EF Core one INSERT batch at a time (a few thousand rows/second), this
/// step streams the source into an <b>UNLOGGED staging table</b> with a raw
/// binary <c>COPY</c> (hundreds of thousands of rows/second), then merges staging
/// into the real table with a single in-database
/// <c>INSERT … SELECT … ON CONFLICT (env_id, key_id) DO NOTHING</c>.
///
/// <para>
/// Why staging + merge rather than COPY straight into <c>end_users</c>: the live
/// table carries the unique index <c>ix_end_users_env_id_key_id</c>, and MongoDB
/// never enforced that uniqueness, so real data contains duplicate
/// <c>(env_id, key_id)</c> pairs. COPY cannot express <c>ON CONFLICT</c>, and a
/// single duplicate aborts the whole COPY stream. Loading into an index-free
/// staging table lets every row land fast; the merge then resolves duplicates in
/// bulk (both against rows already in the target and against each other).
/// </para>
///
/// <para>
/// Safety: the binary values written here (uuid, varchar, jsonb, timestamptz)
/// go through the application's own <see cref="NpgsqlDataSource"/>, so they are
/// byte-identical to the EF Core path. If a COPY batch ever throws — an
/// unforeseen dirty-data class the staging load can't absorb — that exact batch
/// falls back to the inherited EF binary-split save
/// (<see cref="EntityStep{T}.SaveChunkAsync"/>), which isolates and skips only the
/// genuinely bad row(s). No source row is silently lost.
/// </para>
/// </summary>
public sealed class EndUserCopyStep(string name, int copyBatchSize) : EntityStep<EndUser>(name)
{
    private const string StagingTable = "end_users_staging";
    private const string TargetTable = "end_users";

    // Column order shared by the COPY header and the merge statement.
    private const string ColumnList =
        "id, workspace_id, env_id, key_id, name, customized_properties, created_at, updated_at";

    private readonly int _copyBatchSize = copyBatchSize > 0 ? copyBatchSize : 50_000;

    public override async Task<long> CopyAsync(MigrationContext ctx)
    {
        await using var conn = await ctx.DataSource.OpenConnectionAsync();

        await ResetStagingAsync(conn);

        // Phase A: stream the source into the index-free staging table.
        var (copied, fallbackInserted) = await LoadStagingAsync(ctx, conn);

        // Phase B: merge staging into the live table, deduplicating against the
        // unique (env_id, key_id) index in a single bulk statement.
        var mergeInserted = await MergeStagingAsync(conn);

        // Rows that were COPYed but not merged are duplicate (env_id, key_id)
        // pairs the target already holds (or that collapsed against each other).
        var duplicatesSkipped = copied - mergeInserted;
        ctx.RecordBulkSkip(
            Name, (int)duplicatesSkipped,
            "duplicate (env_id, key_id) collapsed by ON CONFLICT");

        await DropStagingAsync(conn);

        var total = mergeInserted + fallbackInserted;
        ctx.Logger.LogInformation(
            "{Entity}: migrated {Count} (copied {Copied}, merged {Merged}, ef-fallback {Fallback}, duplicates skipped {Dupes})",
            Name, total, copied, mergeInserted, fallbackInserted, duplicatesSkipped);
        return total;
    }

    /// <summary>
    /// Streams the source collection, buffering into <see cref="_copyBatchSize"/>
    /// blocks and writing each block with one binary COPY. A block whose COPY
    /// throws is routed, unchanged, to the inherited EF binary-split save so its
    /// good rows still land and only the bad row(s) are skipped.
    /// </summary>
    private async Task<(long Copied, long FallbackInserted)> LoadStagingAsync(
        MigrationContext ctx, NpgsqlConnection conn)
    {
        long copied = 0;
        long fallbackInserted = 0;
        var buffer = new List<EndUser>(_copyBatchSize);

        // Read and write run concurrently — see ReadEntitiesPrefetchedAsync.
        await foreach (var endUser in ReadEntitiesPrefetchedAsync(ctx))
        {
            buffer.Add(endUser);
            if (buffer.Count >= _copyBatchSize)
            {
                (copied, fallbackInserted) =
                    await FlushAsync(ctx, conn, buffer, copied, fallbackInserted);
            }
        }

        (copied, fallbackInserted) = await FlushAsync(ctx, conn, buffer, copied, fallbackInserted);
        return (copied, fallbackInserted);
    }

    private async Task<(long Copied, long FallbackInserted)> FlushAsync(
        MigrationContext ctx, NpgsqlConnection conn, List<EndUser> buffer,
        long copied, long fallbackInserted)
    {
        if (buffer.Count == 0)
        {
            return (copied, fallbackInserted);
        }

        try
        {
            copied += await CopyBatchAsync(conn, buffer);
        }
        catch (Exception ex)
        {
            // Isolate the bad row(s) via the proven EF binary-split path so the
            // rest of this batch is still written. These rows go straight into
            // the live table; the later staging merge skips any staging row that
            // now conflicts with them.
            ctx.Logger.LogWarning(ex,
                "{Entity}: COPY batch of {Count} rows failed; falling back to EF binary-split for this batch.",
                Name, buffer.Count);
            fallbackInserted += await SaveChunkAsync(ctx, buffer.ToArray());
        }

        buffer.Clear();
        return (copied, fallbackInserted);
    }

    private static async Task<long> CopyBatchAsync(NpgsqlConnection conn, List<EndUser> rows)
    {
        await using var importer = await conn.BeginBinaryImportAsync(
            $"COPY {StagingTable} ({ColumnList}) FROM STDIN (FORMAT BINARY)");

        foreach (var e in rows)
        {
            await importer.StartRowAsync();

            await importer.WriteAsync(e.Id, NpgsqlDbType.Uuid);
            await WriteNullableGuidAsync(importer, e.WorkspaceId);
            await WriteNullableGuidAsync(importer, e.EnvId);
            await importer.WriteAsync(e.KeyId, NpgsqlDbType.Varchar);
            await importer.WriteAsync(e.Name, NpgsqlDbType.Varchar);

            if (e.CustomizedProperties is null)
            {
                await importer.WriteNullAsync();
            }
            else
            {
                // Written through the app's data source (EnableDynamicJson + the
                // app's JSON options), so the jsonb bytes match the EF path.
                await importer.WriteAsync(e.CustomizedProperties, NpgsqlDbType.Jsonb);
            }

            await importer.WriteAsync(e.CreatedAt, NpgsqlDbType.TimestampTz);
            await importer.WriteAsync(e.UpdatedAt, NpgsqlDbType.TimestampTz);
        }

        var written = await importer.CompleteAsync();
        return (long)written;
    }

    private static async Task WriteNullableGuidAsync(NpgsqlBinaryImporter importer, Guid? value)
    {
        if (value is Guid guid)
        {
            await importer.WriteAsync(guid, NpgsqlDbType.Uuid);
        }
        else
        {
            await importer.WriteNullAsync();
        }
    }

    private async Task ResetStagingAsync(NpgsqlConnection conn)
    {
        // UNLOGGED = no WAL for the bulk load (faster, and staging is disposable).
        // LIKE copies columns, types and NOT NULL but NOT the unique index, so
        // duplicate (env_id, key_id) rows load without error.
        await ExecuteAsync(conn,
            $"DROP TABLE IF EXISTS {StagingTable}; " +
            $"CREATE UNLOGGED TABLE {StagingTable} (LIKE {TargetTable});");
    }

    private async Task<long> MergeStagingAsync(NpgsqlConnection conn)
    {
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            $"INSERT INTO {TargetTable} ({ColumnList}) " +
            $"SELECT {ColumnList} FROM {StagingTable} " +
            "ON CONFLICT (env_id, key_id) DO NOTHING;";
        // No timeout: merging millions of rows (and building the target indexes)
        // legitimately runs for minutes, far longer than the default 30s.
        cmd.CommandTimeout = 0;
        return await cmd.ExecuteNonQueryAsync();
    }

    private async Task DropStagingAsync(NpgsqlConnection conn) =>
        await ExecuteAsync(conn, $"DROP TABLE IF EXISTS {StagingTable};");

    private static async Task ExecuteAsync(NpgsqlConnection conn, string sql)
    {
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        cmd.CommandTimeout = 0;
        await cmd.ExecuteNonQueryAsync();
    }
}
