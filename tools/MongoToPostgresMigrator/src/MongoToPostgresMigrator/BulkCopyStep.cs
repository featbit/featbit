using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.Extensions.Logging;
using Npgsql;
using NpgsqlTypes;
using Domain.Bases;

namespace MongoToPostgresMigrator;

/// <summary>
/// High-throughput migration for any entity whose only uniqueness constraint is
/// its <c>id</c> primary key (a unique <see cref="Guid"/>). It streams the source
/// collection and writes each block with a raw binary <c>COPY</c> directly into
/// the target table — hundreds of thousands of rows/second versus a few thousand
/// on the EF Core path — which makes it the right choice for the other
/// high-volume tables (<c>audit_logs</c>, <c>flag_revisions</c>).
///
/// <para>
/// No staging table is needed because there is no non-key uniqueness constraint
/// to deduplicate: distinct source <c>_id</c>s map to distinct primary keys, so
/// the load never conflicts. (Contrast <see cref="EndUserCopyStep"/>, which must
/// stage-and-merge to absorb duplicate <c>(env_id, key_id)</c> pairs.)
/// </para>
///
/// <para>
/// The columns, value converters, and PostgreSQL types are read from the
/// application's own EF Core model, so a jsonb/timestamptz/uuid value is written
/// byte-identically to the EF path (jsonb goes through the app's
/// <see cref="NpgsqlDataSource"/> dynamic-JSON mapping). If a COPY block ever
/// throws, that exact block falls back to the inherited EF binary-split save,
/// which isolates and skips only the genuinely bad row(s) — no row is silently
/// lost.
/// </para>
/// </summary>
public sealed class BulkCopyStep<T>(string name, int copyBatchSize) : EntityStep<T>(name) where T : Entity
{
    private readonly int _copyBatchSize = copyBatchSize > 0 ? copyBatchSize : 50_000;

    public override async Task<long> CopyAsync(MigrationContext ctx)
    {
        var columns = BuildColumnMap(ctx);
        var table = ctx.Db.Model.FindEntityType(typeof(T))!.GetTableName()!;
        var columnList = string.Join(", ", columns.Select(c => c.Name));
        var copySql = $"COPY {table} ({columnList}) FROM STDIN (FORMAT BINARY)";

        await using var conn = await ctx.DataSource.OpenConnectionAsync();

        long copied = 0;
        long fallbackInserted = 0;
        var buffer = new List<T>(_copyBatchSize);

        // Read and write run concurrently — see ReadEntitiesPrefetchedAsync.
        await foreach (var entity in ReadEntitiesPrefetchedAsync(ctx))
        {
            buffer.Add(entity);
            if (buffer.Count >= _copyBatchSize)
            {
                (copied, fallbackInserted) =
                    await FlushAsync(ctx, conn, copySql, columns, buffer, copied, fallbackInserted);
            }
        }

        (copied, fallbackInserted) =
            await FlushAsync(ctx, conn, copySql, columns, buffer, copied, fallbackInserted);

        var total = copied + fallbackInserted;
        ctx.Logger.LogInformation(
            "{Entity}: migrated {Count} (copied {Copied}, ef-fallback {Fallback})",
            Name, total, copied, fallbackInserted);
        return total;
    }

    private async Task<(long Copied, long FallbackInserted)> FlushAsync(
        MigrationContext ctx, NpgsqlConnection conn, string copySql, IReadOnlyList<Column> columns,
        List<T> buffer, long copied, long fallbackInserted)
    {
        if (buffer.Count == 0)
        {
            return (copied, fallbackInserted);
        }

        try
        {
            copied += await CopyBatchAsync(conn, copySql, columns, buffer);
        }
        catch (Exception ex)
        {
            ctx.Logger.LogWarning(ex,
                "{Entity}: COPY batch of {Count} rows failed; falling back to EF binary-split for this batch.",
                Name, buffer.Count);
            fallbackInserted += await SaveChunkAsync(ctx, buffer.ToArray());
        }

        buffer.Clear();
        return (copied, fallbackInserted);
    }

    private static async Task<long> CopyBatchAsync(
        NpgsqlConnection conn, string copySql, IReadOnlyList<Column> columns, List<T> rows)
    {
        await using var importer = await conn.BeginBinaryImportAsync(copySql);

        foreach (var entity in rows)
        {
            await importer.StartRowAsync();
            foreach (var column in columns)
            {
                var value = column.ValueOf(entity);
                if (value is null)
                {
                    await importer.WriteNullAsync();
                }
                else
                {
                    await importer.WriteAsync(value, column.Type);
                }
            }
        }

        return (long)await importer.CompleteAsync();
    }

    /// <summary>
    /// Resolves the ordered set of (column name, value accessor, PostgreSQL type)
    /// for the entity from the live EF Core model, so the COPY writes exactly the
    /// columns and types the application persists.
    /// </summary>
    private static IReadOnlyList<Column> BuildColumnMap(MigrationContext ctx)
    {
        var entityType = ctx.Db.Model.FindEntityType(typeof(T))
                         ?? throw new InvalidOperationException($"No EF model for {typeof(T)}.");
        var storeId = StoreObjectIdentifier.Table(entityType.GetTableName()!, entityType.GetSchema());

        var columns = new List<Column>();
        foreach (var property in entityType.GetProperties())
        {
            var columnName = property.GetColumnName(storeId);
            if (string.IsNullOrEmpty(columnName))
            {
                continue;
            }

            var propertyInfo = property.PropertyInfo
                               ?? throw new InvalidOperationException(
                                   $"Property {property.Name} on {typeof(T)} has no CLR accessor; " +
                                   "the generic COPY writer only supports mapped CLR properties.");
            var converter = property.GetValueConverter();
            var npgsqlType = NpgsqlTypeMap.Map(property.GetColumnType());

            columns.Add(new Column(columnName, npgsqlType, entity =>
            {
                var raw = propertyInfo.GetValue(entity);
                return raw is not null && converter is not null ? converter.ConvertToProvider(raw) : raw;
            }));
        }

        return columns;
    }

    private sealed record Column(string Name, NpgsqlDbType Type, Func<T, object?> ValueOf);
}
