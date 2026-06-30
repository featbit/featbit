using System.Text;
using System.Text.Json;
using Infrastructure.Persistence.MongoDb;
using MongoDB.Bson;

namespace Infrastructure.UnitTests.Persistence.MongoDb;

public class BsonDocumentExtensionsTests
{
    [Fact]
    public void ToJsonBytes_DocumentWithUnderscoreId_NormalizesIdField()
    {
        var doc = new BsonDocument
        {
            { "_id", "abc123" },
            { "key", "value" }
        };

        var bytes = doc.ToJsonBytes();
        var json = Encoding.UTF8.GetString(bytes);

        Assert.Contains("\"id\":\"abc123\"", json);
        Assert.DoesNotContain("_id", json);
        Assert.Contains("\"key\":\"value\"", json);
    }

    [Fact]
    public void ToJsonBytes_DocumentWithoutUnderscoreId_LeavesOtherFieldsIntact()
    {
        var doc = new BsonDocument
        {
            { "name", "feature-a" },
            { "enabled", true }
        };

        var bytes = doc.ToJsonBytes();
        var json = Encoding.UTF8.GetString(bytes);

        Assert.Contains("\"name\":\"feature-a\"", json);
        Assert.Contains("\"enabled\":true", json);
    }

    [Fact]
    public void ToJsonElement_DocumentWithUnderscoreId_ReturnsJsonElementWithIdProperty()
    {
        var doc = new BsonDocument
        {
            { "_id", "id-1" },
            { "n", 42 }
        };

        var element = doc.ToJsonElement();

        Assert.Equal("id-1", element.GetProperty("id").GetString());
        Assert.Equal(42, element.GetProperty("n").GetInt32());
        Assert.False(element.TryGetProperty("_id", out _));
    }

    [Fact]
    public void ToJsonElement_EmptyDocument_ReturnsEmptyJsonObject()
    {
        var element = new BsonDocument().ToJsonElement();

        Assert.Equal(JsonValueKind.Object, element.ValueKind);
        Assert.Empty(element.EnumerateObject());
    }
}
