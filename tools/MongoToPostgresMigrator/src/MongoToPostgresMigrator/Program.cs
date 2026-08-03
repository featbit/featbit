using System.Text.Json;
using Domain.FeatureFlags;
using Infrastructure;
using Infrastructure.Persistence.EntityFrameworkCore;
using Infrastructure.Persistence.MongoDb;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using MongoDB.Driver;
using Npgsql;

namespace MongoToPostgresMigrator;

/// <summary>
/// Copies a FeatBit MongoDB database into an empty PostgreSQL schema by reading
/// each collection into the shared Domain POCO and writing it back through EF
/// Core. See docs/how-it-works.md for the full specification.
/// </summary>
public static class Program
{
    // Exit codes (see tool-spec.md §11).
    private const int ExitSuccess = 0;
    private const int ExitTargetNotEmpty = 2;
    private const int ExitCopyThrew = 3;
    private const int ExitVerifyMismatch = 4;

    // Number of FeatureFlags sampled for the jsonb integrity spot-check.
    private const int JsonbSampleSize = 25;

    // Npgsql's defaults (15s connect, 30s command) assume a local database. A
    // migration run crosses a network, moves millions of rows, and — critically
    // — the raw NpgsqlDataSource used by the COPY steps has NO EF execution
    // strategy, so unlike the EF path a transient timeout is not retried: it
    // aborts the run (exit 3) leaving partial data. These floors buy headroom
    // for a slow connect (DNS + TCP + TLS + directory auth) and for verify's
    // COUNT(*) over multi-million-row tables.
    private const int MinConnectTimeoutSeconds = 30;
    private const int MinCommandTimeoutSeconds = 300;

    /// <summary>
    /// Raises the PostgreSQL connect and command timeouts to a floor suitable
    /// for a cross-network migration. Values already configured higher are left
    /// alone, and an explicit <c>CommandTimeout=0</c> (infinite) is preserved.
    /// </summary>
    /// <returns>The effective timeouts, for logging, or null if unchanged.</returns>
    private static (int Connect, int Command)? ApplyPostgresTimeoutFloors(
        ConfigurationManager configuration)
    {
        var connectionString = configuration["Postgres:ConnectionString"];
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            return null;
        }

        var csb = new NpgsqlConnectionStringBuilder(connectionString);

        var connect = Math.Max(csb.Timeout, MinConnectTimeoutSeconds);
        // 0 means "no timeout" — a deliberate choice, never something to lower.
        var command = csb.CommandTimeout == 0
            ? 0
            : Math.Max(csb.CommandTimeout, MinCommandTimeoutSeconds);

        if (connect == csb.Timeout && command == csb.CommandTimeout)
        {
            return null;
        }

        csb.Timeout = connect;
        csb.CommandTimeout = command;

        // The rebuilt string may contain the password, so it is only ever put
        // back into configuration — never logged.
        configuration.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Postgres:ConnectionString"] = csb.ToString()
        });

        return (connect, command);
    }

    public static async Task<int> Main(string[] args)
    {
        var dryRun = args.Contains("--dry-run", StringComparer.OrdinalIgnoreCase);

        // Do NOT forward args to the config command-line provider: a bare
        // "--dry-run" switch would trip its key/value parser. Config still comes
        // from appsettings.json + environment variables.
        var builder = Host.CreateApplicationBuilder(new HostApplicationBuilderSettings
        {
            Args = []
        });

        // Reusing the application's DI extensions guarantees byte-identical
        // mapping on both sides. Touching Infrastructure here also fires
        // Infrastructure.Initialization (a [ModuleInitializer]) which registers
        // the Guid serializer, camelCase conventions, and ClassMaps.
        builder.Services.TryAddMongoDb(builder.Configuration);

        // Must run BEFORE TryAddPostgres: that call reads the connection string
        // eagerly to build the NpgsqlDataSource, so a later change is ignored.
        var timeouts = ApplyPostgresTimeoutFloors(builder.Configuration);

        builder.Services.TryAddPostgres(builder.Configuration);

        // Timestamp every console line. Migration runs are long and are captured
        // to a log file, so per-line times are what make it possible to attribute
        // elapsed time to a specific entity (and to spot stalls between batches).
        // UTC keeps the log comparable with server-side timings.
        builder.Logging.AddSimpleConsole(options =>
        {
            options.TimestampFormat = "[yyyy-MM-dd HH:mm:ss.fff] ";
            options.UseUtcTimestamp = true;
        });

        using var host = builder.Build();

        var logger = host.Services.GetRequiredService<ILoggerFactory>().CreateLogger("MongoToPostgresMigrator");
        var configuration = host.Services.GetRequiredService<IConfiguration>();
        var batchSize = configuration.GetValue("Migrator:BatchSize", 500);
        var copyBatchSize = configuration.GetValue("Migrator:CopyBatchSize", 1000);

        // Optional: entities to skip this run (e.g. EndUsers during a freeze
        // migration, backfilled online afterwards). Case-insensitive; unknown
        // names are reported rather than silently ignored.
        var excludeNames = configuration.GetSection("Migrator:ExcludeEntities").Get<string[]>() ?? [];
        var exclude = new HashSet<string>(excludeNames, StringComparer.OrdinalIgnoreCase);

        var mongo = host.Services.GetRequiredService<MongoDbClient>();
        var dataSource = host.Services.GetRequiredService<NpgsqlDataSource>();
        using var scope = host.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var ctx = new MigrationContext(mongo, db, dataSource, batchSize, logger);

        var unknownExcludes = exclude.Where(e => !MigrationPipeline.KnownEntityNames.Contains(e)).ToList();
        if (unknownExcludes.Count > 0)
        {
            logger.LogWarning(
                "Migrator:ExcludeEntities names {Unknown} do not match any known entity and will have no effect. " +
                "Known entities: {Known}.",
                string.Join(", ", unknownExcludes),
                string.Join(", ", MigrationPipeline.KnownEntityNames.OrderBy(n => n)));
        }

        var steps = MigrationPipeline.Build(copyBatchSize, exclude);

        if (exclude.Count > 0)
        {
            logger.LogWarning(
                "Excluding {Count} entity(ies) from this run — they will NOT be copied or verified: {Names}. " +
                "Populate them separately (e.g. an online backfill) before cutover.",
                exclude.Count, string.Join(", ", exclude.OrderBy(n => n)));
        }

        logger.LogInformation(
            "MongoToPostgresMigrator starting ({Mode}, batch size {BatchSize}, copy batch size {CopyBatchSize})",
            dryRun ? "dry-run" : "migrate", batchSize, copyBatchSize);

        if (timeouts is { } t)
        {
            logger.LogInformation(
                "PostgreSQL timeouts raised for this run: connect {Connect}s, command {Command}. " +
                "The COPY path has no automatic retry, so the defaults (15s/30s) risk aborting " +
                "a cross-network run with partial data.",
                t.Connect, t.Command == 0 ? "unlimited" : $"{t.Command}s");
        }

        // 1. Preflight — every target table must be empty. Also captures the
        //    source counts used both for the dry-run report and the live-write
        //    guard during verify.
        var (targetEmpty, sourceCounts) = await PreflightAsync(ctx, steps);
        PrintCountTable(sourceCounts);

        if (!targetEmpty)
        {
            logger.LogError(
                "Preflight failed: target is not empty. Truncate the 29 domain tables and re-run.");
            return ExitTargetNotEmpty;
        }

        if (dryRun)
        {
            logger.LogInformation("Dry-run complete. Target is empty; nothing was written.");
            return ExitSuccess;
        }

        // 2. Migrate — fail-fast. A throwing step stops the run and leaves partial
        //    data in place for inspection (recovery is truncate-all + rerun).
        foreach (var step in steps)
        {
            try
            {
                await step.CopyAsync(ctx);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Copy step '{Entity}' failed. Aborting (partial data left in place).",
                    step.Name);
                return ExitCopyThrew;
            }
        }

        // 3. Verify — counts must match, no live writes, jsonb intact.
        if (ctx.ReassignedIds > 0)
        {
            logger.LogWarning(
                "{Count} document(s) had a non-UUID _id and were given a fresh id during copy. " +
                "See the warnings above for the affected entities.", ctx.ReassignedIds);
        }

        if (ctx.TotalSkipped > 0)
        {
            var breakdown = string.Join(", ", ctx.SkippedByEntity.Select(kv => $"{kv.Key}={kv.Value}"));
            logger.LogWarning(
                "{Count} row(s) were skipped because they violated a target constraint: {Breakdown}. " +
                "See the warnings above for the specific rows and reasons.",
                ctx.TotalSkipped, breakdown);
        }

        var verified = await VerifyAsync(ctx, steps, sourceCounts);
        if (!verified)
        {
            return ExitVerifyMismatch;
        }

        logger.LogInformation("Migration complete. All entities verified.");
        return ExitSuccess;
    }

    private static async Task<(bool TargetEmpty, IReadOnlyList<CountRow> SourceCounts)> PreflightAsync(
        MigrationContext ctx, IReadOnlyList<IEntityStep> steps)
    {
        var rows = new List<CountRow>();
        var targetEmpty = true;

        foreach (var step in steps)
        {
            var source = await step.CountSourceAsync(ctx);
            var target = await step.CountTargetAsync(ctx);
            rows.Add(new CountRow(step.Name, source, target));

            if (target != 0)
            {
                targetEmpty = false;
                ctx.Logger.LogError("Preflight: target table for '{Entity}' has {Count} rows (expected 0).",
                    step.Name, target);
            }
        }

        return (targetEmpty, rows);
    }

    private static async Task<bool> VerifyAsync(
        MigrationContext ctx, IReadOnlyList<IEntityStep> steps, IReadOnlyList<CountRow> preflight)
    {
        var ok = true;
        var preflightByName = preflight.ToDictionary(r => r.Entity, r => r.Source);

        foreach (var step in steps)
        {
            var sourceNow = await step.CountSourceAsync(ctx);
            var target = await step.CountTargetAsync(ctx);
            var sourceBefore = preflightByName[step.Name];
            var skipped = ctx.SkippedFor(step.Name);

            // Live-write guard: the source must have been frozen for the run.
            // Either growth (new writes leaked in) or shrink (rows deleted) is a
            // failure. The decision logic lives in VerifyMath so it can be
            // unit-tested DB-free.
            switch (VerifyMath.CheckSourceGuard(sourceBefore, sourceNow))
            {
                case SourceGuard.Grew:
                    ok = false;
                    ctx.Logger.LogError(
                        "Verify: source '{Entity}' grew during the run ({Before} -> {After}). " +
                        "Writes were not quiesced.", step.Name, sourceBefore, sourceNow);
                    break;
                case SourceGuard.Shrank:
                    ok = false;
                    ctx.Logger.LogError(
                        "Verify: source '{Entity}' shrank during the run ({Before} -> {After}). " +
                        "Writes were not quiesced.", step.Name, sourceBefore, sourceNow);
                    break;
            }

            // Target should hold every source row except those explicitly skipped
            // for violating a target constraint.
            var count = VerifyMath.CheckCount(sourceNow, target, skipped);
            if (!count.Ok)
            {
                ok = false;
                ctx.Logger.LogError(
                    "Verify: count mismatch for '{Entity}': source {Source}, skipped {Skipped}, " +
                    "target {Target} (expected {Expected}).",
                    step.Name, sourceNow, skipped, target, count.Expected);
            }
        }

        if (!await VerifyFeatureFlagJsonAsync(ctx))
        {
            ok = false;
        }

        return ok;
    }

    /// <summary>
    /// jsonb integrity spot-check: pull a sample of FeatureFlags by Id from both
    /// stores and assert their jsonb-backed members serialize identically. This
    /// catches a silent serialization regression that raw counts would miss.
    /// </summary>
    private static async Task<bool> VerifyFeatureFlagJsonAsync(MigrationContext ctx)
    {
        var ids = await ctx.Db.Set<FeatureFlag>()
            .Select(f => f.Id)
            .Take(JsonbSampleSize)
            .ToListAsync();

        if (ids.Count == 0)
        {
            return true;
        }

        var mongoCollection = ctx.Mongo.CollectionOf<FeatureFlag>();
        var ok = true;

        foreach (var id in ids)
        {
            var source = await mongoCollection.Find(f => f.Id == id).FirstOrDefaultAsync();
            var target = await ctx.Db.Set<FeatureFlag>().FirstOrDefaultAsync(f => f.Id == id);

            if (source is null || target is null)
            {
                ok = false;
                ctx.Logger.LogError("jsonb spot-check: FeatureFlag {Id} missing on one side.", id);
                continue;
            }

            if (Fingerprint(source) != Fingerprint(target))
            {
                ok = false;
                ctx.Logger.LogError(
                    "jsonb spot-check: FeatureFlag {Id} differs between source and target.", id);
            }
        }

        if (ok)
        {
            ctx.Logger.LogInformation("jsonb spot-check passed on {Count} FeatureFlags.", ids.Count);
        }

        return ok;

        static string Fingerprint(FeatureFlag f) => JsonSerializer.Serialize(new
        {
            f.Variations,
            f.Rules,
            f.Fallthrough,
            f.Tags
        });
    }

    private static void PrintCountTable(IReadOnlyList<CountRow> rows)
    {
        Console.WriteLine();
        Console.WriteLine($"{"Entity",-22}{"Source",12}{"Target",12}");
        Console.WriteLine(new string('-', 46));
        foreach (var row in rows)
        {
            Console.WriteLine($"{row.Entity,-22}{row.Source,12}{row.Target,12}");
        }
        Console.WriteLine(new string('-', 46));
        Console.WriteLine($"{"TOTAL",-22}{rows.Sum(r => r.Source),12}{rows.Sum(r => r.Target),12}");
        Console.WriteLine();
    }

    private readonly record struct CountRow(string Entity, long Source, long Target);
}
