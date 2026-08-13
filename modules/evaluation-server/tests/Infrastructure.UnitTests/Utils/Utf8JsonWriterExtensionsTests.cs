using System.Text;
using System.Text.Json;
using Infrastructure.Utils;

namespace Infrastructure.UnitTests.Utils;

public class Utf8JsonWriterExtensionsTests
{
    [Fact]
    public void WriteJsonString_NullValue_WritesJsonNull()
    {
        var json = Write(writer => writer.WriteJsonString("p", null));

        Assert.Equal("{\"p\":null}", json);
    }

    [Fact]
    public void WriteJsonString_RawJsonObject_WritesObjectAsRawValue()
    {
        var json = Write(writer => writer.WriteJsonString("p", "{\"k\":1}"));

        Assert.Equal("{\"p\":{\"k\":1}}", json);
    }

    [Fact]
    public void WriteJsonString_RawJsonArray_WritesArrayAsRawValue()
    {
        var json = Write(writer => writer.WriteJsonString("p", "[1,2,3]"));

        Assert.Equal("{\"p\":[1,2,3]}", json);
    }

    [Fact]
    public void WriteStringArray_NullValue_WritesJsonNull()
    {
        var json = Write(writer => writer.WriteStringArray("p", null));

        Assert.Equal("{\"p\":null}", json);
    }

    [Fact]
    public void WriteStringArray_EmptyArray_WritesEmptyJsonArray()
    {
        var json = Write(writer => writer.WriteStringArray("p", Array.Empty<string>()));

        Assert.Equal("{\"p\":[]}", json);
    }

    [Fact]
    public void WriteStringArray_NonEmptyArray_WritesEachItemAsJsonString()
    {
        var json = Write(writer => writer.WriteStringArray("p", new[] { "a", "b", "c" }));

        Assert.Equal("{\"p\":[\"a\",\"b\",\"c\"]}", json);
    }

    private static string Write(Action<Utf8JsonWriter> body)
    {
        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream))
        {
            writer.WriteStartObject();
            body(writer);
            writer.WriteEndObject();
        }

        return Encoding.UTF8.GetString(stream.ToArray());
    }
}
