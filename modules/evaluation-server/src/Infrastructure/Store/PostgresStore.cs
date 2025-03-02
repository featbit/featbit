using System.Text.Json;
using Dapper;
using Domain.Shared;
using Infrastructure.Utils;
using Npgsql;

namespace Infrastructure.Store;

public class PostgresStore(NpgsqlDataSource dataSource) : IDbStore
{
    public string Name => Stores.Postgres;

    public async Task<bool> IsAvailableAsync()
    {
        try
        {
            await using var connection = await dataSource.OpenConnectionAsync();
            await connection.ExecuteScalarAsync("select 1");

            return true;
        }
        catch (Exception)
        {
            return false;
        }
    }

    public async Task<IEnumerable<byte[]>> GetFlagsAsync(Guid envId, long timestamp)
    {
        await using var connection = await dataSource.OpenConnectionAsync();

        var rows = await connection.QueryAsync(
            "select * from feature_flags where env_id = @envId and updated_at > @time",
            new { envId, time = DateTime.UnixEpoch.AddMilliseconds(timestamp) }
        );

        return rows.Select(row => SerializeFlag((row as IDictionary<string, object>)!));
    }

    public async Task<IEnumerable<byte[]>> GetFlagsAsync(IEnumerable<string> ids)
    {
        await using var connection = await dataSource.OpenConnectionAsync();

        var rows = await connection.QueryAsync(
            "select * from feature_flags where id = any(@ids::uuid[])",
            new { ids }
        );

        return rows.Select(row => SerializeFlag((row as IDictionary<string, object>)!));
    }

    public async Task<byte[]> GetSegmentAsync(string id)
    {
        await using var connection = await dataSource.OpenConnectionAsync();

        var segment = await connection.QueryFirstOrDefaultAsync(
            "select * from segments where id = @id::uuid",
            new { id }
        );

        return SerializeSegment((segment as IDictionary<string, object>)!);
    }

    public async Task<IEnumerable<byte[]>> GetSegmentsAsync(Guid envId, long timestamp)
    {
        await using var connection = await dataSource.OpenConnectionAsync();

        IDictionary<string, object>? rnRow = await connection.QueryFirstOrDefaultAsync(
            """
            select 'organization/' || org.key || ':project/' || proj.key || ':env/' || env.key as rn,
                   org.workspace_id as workspace_id
            from organizations org
                     join projects proj on org.id = proj.organization_id
                     join environments env on proj.id = env.project_id
            where env.id = @envId
            """, new { envId });
        if (rnRow == null)
        {
            return [];
        }

        var rows = await connection.QueryAsync(
            """
            select * from segments
            where updated_at > @time
              and workspace_id = @workspaceId
              and exists (
                  select 1
                  from unnest(scopes) as scope
                  where @envRN ^@ (scope || ':')
              )
            """,
            new
            {
                time = DateTime.UnixEpoch.AddMilliseconds(timestamp),
                workspaceId = (Guid)rnRow["workspace_id"],
                envRN = $"{rnRow["rn"] as string}:"
            }
        );

        return rows.Select(row => SerializeSegment((row as IDictionary<string, object>)!));
    }

    public async Task<Secret?> GetSecretAsync(string secretString)
    {
        if (!Secret.TryParse(secretString, out var envId))
        {
            return null;
        }

        await using var connection = await dataSource.OpenConnectionAsync();

        IDictionary<string, object>? row = await connection.QueryFirstOrDefaultAsync(
            """
            select env.id as env_id, env.key as env_key, env.secrets as env_secrets, pro.key as project_key
            from environments env
                     join projects pro on env.project_id = pro.id
            where env.id = @envId
            """, new { envId }
        );

        if (row is null)
        {
            return null;
        }

        using var json = JsonDocument.Parse((row["env_secrets"] as string)!);
        foreach (var element in json.RootElement.EnumerateArray())
        {
            if (element.GetProperty("value").GetString() == secretString)
            {
                return new Secret(
                    element.GetProperty("type").GetString()!,
                    (row["project_key"] as string)!,
                    (Guid)row["env_id"],
                    (row["env_key"] as string)!
                );
            }
        }

        // no matching secret found
        return null;
    }

    private static byte[] SerializeFlag(IDictionary<string, object> row)
    {
        using MemoryStream stream = new();
        using Utf8JsonWriter writer = new(stream);

        // ignore the following properties as they're unnecessary: 
        // revision, tags, is_archived, created_at, creator_id, updator_id

        writer.WriteStartObject();

        writer.WriteString("id", (Guid)row["id"]);
        writer.WriteString("envId", (Guid)row["env_id"]);
        writer.WriteString("name", row["name"] as string);
        writer.WriteString("description", row["description"] as string);
        writer.WriteString("key", row["key"] as string);
        writer.WriteString("variationType", row["variation_type"] as string);
        writer.WriteJsonString("variations", row["variations"] as string);
        writer.WriteJsonString("targetUsers", row["target_users"] as string);
        writer.WriteJsonString("rules", row["rules"] as string);
        writer.WriteBoolean("isEnabled", (bool)row["is_enabled"]);
        writer.WriteString("disabledVariationId", row["disabled_variation_id"] as string);
        writer.WriteJsonString("fallthrough", row["fallthrough"] as string);
        writer.WriteBoolean("exptIncludeAllTargets", (bool)row["expt_include_all_targets"]);
        writer.WriteString("updatedAt", (DateTime)row["updated_at"]);

        writer.WriteEndObject();

        writer.Flush();
        return stream.ToArray();
    }

    private static byte[] SerializeSegment(IDictionary<string, object> row)
    {
        using MemoryStream stream = new();
        using Utf8JsonWriter writer = new(stream);

        // ignore the following properties as they're unnecessary:
        // workspace_id, type, scopes, is_archived, created_at
        writer.WriteStartObject();

        writer.WriteString("id", (Guid)row["id"]);
        writer.WriteString("envId", (Guid)row["env_id"]);
        writer.WriteString("name", row["name"] as string);
        writer.WriteString("description", row["description"] as string);
        writer.WriteStringArray("included", row["included"] as string[]);
        writer.WriteStringArray("excluded", row["excluded"] as string[]);
        writer.WriteJsonString("rules", row["rules"] as string);
        writer.WriteString("updatedAt", (DateTime)row["updated_at"]);

        writer.WriteEndObject();

        writer.Flush();
        return stream.ToArray();
    }
}