using System.Text.RegularExpressions;
using Npgsql;
using Testcontainers.PostgreSql;

namespace Infrastructure.IntegrationTests.Fixtures;

/// <summary>
/// A Postgres container initialised by replaying the repository's production
/// init scripts from <c>infra/postgresql/docker-entrypoint-initdb.d/</c>.
///
/// The scripts are embedded into the test assembly (see csproj) and executed
/// in version order against the container so the EF service tests run against
/// the same schema operators deploy. <c>\connect featbit</c> meta-commands are
/// stripped and the bootstrap <c>create database featbit</c> is routed to the
/// default <c>postgres</c> database; everything else (table DDL, constraints,
/// indexes, ALTERs across versions) runs verbatim.
/// </summary>
public sealed class FeatBitPostgresFixture : IAsyncLifetime
{
    private const string ResourcePrefix = "FeatBitPostgresInitDb.";
    private const string TargetDatabase = "featbit";
    private static readonly Regex ConnectMeta =
        new(@"^\s*\\connect\s+featbit\s*;?\s*$", RegexOptions.IgnoreCase | RegexOptions.Multiline);
    private static readonly Regex VersionInName =
        new(@"v(\d+)\.(\d+)\.(\d+)", RegexOptions.IgnoreCase);

    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .Build();

    public string ConnectionString { get; private set; } = string.Empty;

    public async Task InitializeAsync()
    {
        if (!DockerAvailability.IsAvailable)
        {
            return;
        }

        await _container.StartAsync();

        var bootstrapConnStr = _container.GetConnectionString();
        ConnectionString = new NpgsqlConnectionStringBuilder(bootstrapConnStr)
        {
            Database = TargetDatabase
        }.ToString();

        await ApplyInitScriptsAsync(bootstrapConnStr);
    }

    public async Task DisposeAsync()
    {
        if (!DockerAvailability.IsAvailable)
        {
            return;
        }

        await _container.DisposeAsync();
    }

    private static async Task ApplyInitScriptsAsync(string bootstrapConnStr)
    {
        var scripts = LoadEmbeddedScripts();

        var targetConnStr = new NpgsqlConnectionStringBuilder(bootstrapConnStr)
        {
            Database = TargetDatabase
        }.ToString();

        await using var bootstrap = new NpgsqlConnection(bootstrapConnStr);
        await bootstrap.OpenAsync();

        foreach (var (name, content) in scripts)
        {
            var segments = ConnectMeta.Split(content);
            for (var i = 0; i < segments.Length; i++)
            {
                var sql = segments[i].Trim();
                if (sql.Length == 0)
                {
                    continue;
                }

                var runOnBootstrap = i == 0 && name.Contains("v0.0.0") &&
                                     sql.Contains("create database", StringComparison.OrdinalIgnoreCase);

                if (runOnBootstrap)
                {
                    await ExecuteAsync(bootstrap, sql);
                }
                else
                {
                    await using var conn = new NpgsqlConnection(targetConnStr);
                    await conn.OpenAsync();
                    await ExecuteAsync(conn, sql);
                }
            }
        }
    }

    private static async Task ExecuteAsync(NpgsqlConnection conn, string sql)
    {
        await using var cmd = new NpgsqlCommand(sql, conn);
        await cmd.ExecuteNonQueryAsync();
    }

    private static IEnumerable<(string Name, string Content)> LoadEmbeddedScripts()
    {
        var asm = typeof(FeatBitPostgresFixture).Assembly;
        var names = asm.GetManifestResourceNames()
            .Where(n => n.StartsWith(ResourcePrefix, StringComparison.Ordinal))
            .OrderBy(VersionKey)
            .ThenBy(n => n, StringComparer.Ordinal)
            .ToArray();

        if (names.Length == 0)
        {
            throw new InvalidOperationException(
                $"No embedded init scripts found with prefix '{ResourcePrefix}'. " +
                "Check the EmbeddedResource glob in Infrastructure.IntegrationTests.csproj.");
        }

        foreach (var name in names)
        {
            using var stream = asm.GetManifestResourceStream(name)
                               ?? throw new InvalidOperationException($"Unable to open resource {name}.");
            using var reader = new StreamReader(stream);
            yield return (name, reader.ReadToEnd());
        }
    }

    private static (int Major, int Minor, int Patch) VersionKey(string name)
    {
        var m = VersionInName.Match(name);
        return m.Success
            ? (int.Parse(m.Groups[1].Value), int.Parse(m.Groups[2].Value), int.Parse(m.Groups[3].Value))
            : (int.MaxValue, int.MaxValue, int.MaxValue);
    }
}
