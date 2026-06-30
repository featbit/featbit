using System.Text.Json;
using Infrastructure.Persistence.Postgres;

namespace Infrastructure.UnitTests.Persistence.Postgres;

public class RowSerializerTests
{
    [Fact]
    public void SerializeFlag_FullRow_ProducesExpectedJson()
    {
        var id = Guid.Parse("11111111-1111-1111-1111-111111111111");
        var envId = Guid.Parse("22222222-2222-2222-2222-222222222222");
        var updatedAt = new DateTime(2024, 1, 15, 12, 0, 0, DateTimeKind.Utc);

        var row = new Dictionary<string, object>
        {
            ["id"] = id,
            ["env_id"] = envId,
            ["name"] = "flag-name",
            ["description"] = "a flag",
            ["key"] = "flag-key",
            ["variation_type"] = "boolean",
            ["variations"] = "[{\"id\":\"v1\",\"value\":\"true\"}]",
            ["target_users"] = "[]",
            ["rules"] = "[]",
            ["is_enabled"] = true,
            ["disabled_variation_id"] = "v0",
            ["fallthrough"] = "{\"variation\":\"v1\"}",
            ["expt_include_all_targets"] = false,
            ["tags"] = new[] { "x", "y" },
            ["updated_at"] = updatedAt,
            ["is_archived"] = false
        };

        var bytes = RowSerializer.SerializeFlag(row);
        var element = JsonSerializer.Deserialize<JsonElement>(bytes);

        Assert.Equal(id, element.GetProperty("id").GetGuid());
        Assert.Equal(envId, element.GetProperty("envId").GetGuid());
        Assert.Equal("flag-name", element.GetProperty("name").GetString());
        Assert.Equal("flag-key", element.GetProperty("key").GetString());
        Assert.Equal("boolean", element.GetProperty("variationType").GetString());
        Assert.True(element.GetProperty("isEnabled").GetBoolean());
        Assert.False(element.GetProperty("exptIncludeAllTargets").GetBoolean());
        Assert.False(element.GetProperty("isArchived").GetBoolean());
        Assert.Equal(JsonValueKind.Array, element.GetProperty("variations").ValueKind);
        Assert.Equal(JsonValueKind.Array, element.GetProperty("targetUsers").ValueKind);
        Assert.Equal(JsonValueKind.Array, element.GetProperty("rules").ValueKind);
        Assert.Equal(JsonValueKind.Object, element.GetProperty("fallthrough").ValueKind);
        Assert.Equal(new[] { "x", "y" },
            element.GetProperty("tags").EnumerateArray().Select(x => x.GetString()).ToArray());
    }

    [Fact]
    public void SerializeFlag_NullTagsValue_DefaultsToEmptyArray()
    {
        var row = NewFlagRow();
        row["tags"] = null!;

        var bytes = RowSerializer.SerializeFlag(row);
        var element = JsonSerializer.Deserialize<JsonElement>(bytes);

        Assert.Equal(JsonValueKind.Array, element.GetProperty("tags").ValueKind);
        Assert.Empty(element.GetProperty("tags").EnumerateArray());
    }

    [Fact]
    public void SerializeSegment_FullRow_ProducesExpectedJson()
    {
        var id = Guid.Parse("33333333-3333-3333-3333-333333333333");
        var envId = Guid.Parse("44444444-4444-4444-4444-444444444444");
        var updatedAt = new DateTime(2024, 6, 1, 9, 30, 0, DateTimeKind.Utc);

        var row = new Dictionary<string, object>
        {
            ["id"] = id,
            ["env_id"] = envId,
            ["name"] = "seg-name",
            ["description"] = "a segment",
            ["included"] = new[] { "alice", "bob" },
            ["excluded"] = new[] { "mallory" },
            ["rules"] = "[]",
            ["updated_at"] = updatedAt,
            ["is_archived"] = false
        };

        var bytes = RowSerializer.SerializeSegment(row);
        var element = JsonSerializer.Deserialize<JsonElement>(bytes);

        Assert.Equal(id, element.GetProperty("id").GetGuid());
        Assert.Equal(envId, element.GetProperty("envId").GetGuid());
        Assert.Equal("seg-name", element.GetProperty("name").GetString());
        Assert.Equal(new[] { "alice", "bob" },
            element.GetProperty("included").EnumerateArray().Select(x => x.GetString()).ToArray());
        Assert.Equal(new[] { "mallory" },
            element.GetProperty("excluded").EnumerateArray().Select(x => x.GetString()).ToArray());
        Assert.False(element.GetProperty("isArchived").GetBoolean());
    }

    private static Dictionary<string, object> NewFlagRow() => new()
    {
        ["id"] = Guid.NewGuid(),
        ["env_id"] = Guid.NewGuid(),
        ["name"] = "n",
        ["description"] = "d",
        ["key"] = "k",
        ["variation_type"] = "boolean",
        ["variations"] = "[]",
        ["target_users"] = "[]",
        ["rules"] = "[]",
        ["is_enabled"] = true,
        ["disabled_variation_id"] = "v",
        ["fallthrough"] = "{}",
        ["expt_include_all_targets"] = false,
        ["tags"] = new[] { "t" },
        ["updated_at"] = DateTime.UtcNow,
        ["is_archived"] = false
    };
}
