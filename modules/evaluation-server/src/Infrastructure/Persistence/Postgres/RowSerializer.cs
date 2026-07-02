using System.Text.Json;
using Infrastructure.Utils;

namespace Infrastructure.Persistence.Postgres;

public static class RowSerializer
{
    public static byte[] SerializeFlag(IDictionary<string, object> row)
    {
        using MemoryStream stream = new();
        using Utf8JsonWriter writer = new(stream);

        // ignore the following properties as they're unnecessary: 
        // revision, created_at, creator_id, updator_id

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
        writer.WriteStringArray("tags", row["tags"] as string[] ?? []);
        writer.WriteString("updatedAt", (DateTime)row["updated_at"]);
        writer.WriteBoolean("isArchived", (bool)row["is_archived"]);

        writer.WriteEndObject();

        writer.Flush();
        return stream.ToArray();
    }

    public static byte[] SerializeSegment(IDictionary<string, object> row)
    {
        using MemoryStream stream = new();
        using Utf8JsonWriter writer = new(stream);

        // ignore the following properties as they're unnecessary:
        // workspace_id, type, scopes, created_at
        writer.WriteStartObject();

        writer.WriteString("id", (Guid)row["id"]);
        writer.WriteString("envId", (Guid)row["env_id"]);
        writer.WriteString("name", row["name"] as string);
        writer.WriteString("description", row["description"] as string);
        writer.WriteStringArray("included", row["included"] as string[]);
        writer.WriteStringArray("excluded", row["excluded"] as string[]);
        writer.WriteJsonString("rules", row["rules"] as string);
        writer.WriteString("updatedAt", (DateTime)row["updated_at"]);
        writer.WriteBoolean("isArchived", (bool)row["is_archived"]);

        writer.WriteEndObject();

        writer.Flush();
        return stream.ToArray();
    }
}