using System.Text;
using System.Text.Json;
using Domain.Evaluation;

namespace Domain.UnitTests.Evaluation;

public class EntityJsonReaderTests
{
    private const string SegmentId = "0779d76b-afc6-4886-ab65-af8c004273ad";

    [Fact]
    public void TryGetString_StringProperty_ReturnsValue()
    {
        var json = Parse("""{"key":"flag-key"}""");

        var value = EntityJsonReader.TryGetString(json, "key");

        Assert.Equal("flag-key", value);
    }

    [Theory]
    [InlineData("{}")]
    [InlineData("{\"key\":null}")]
    [InlineData("{\"key\":1}")]
    [InlineData("[]")]
    public void TryGetString_PropertyCannotBeRead_ReturnsNull(string jsonText)
    {
        var json = Parse(jsonText);

        var value = EntityJsonReader.TryGetString(json, "key");

        Assert.Null(value);
    }

    [Fact]
    public void GetNullableString_NullValue_ReturnsNull()
    {
        var json = Parse("""{"dispatchKey":null}""");

        var value = EntityJsonReader.FeatureFlag.GetNullableString(json, "dispatchKey");

        Assert.Null(value);
    }

    [Fact]
    public void GetRequiredString_MissingFlagProperty_ThrowsWithFlagContext()
    {
        var json = Parse("{}");

        var exception = Assert.Throws<MalformedDataException>(
            () => EntityJsonReader.FeatureFlag.GetRequiredString(json, "key")
        );

        Assert.Equal(EvaluationEntityType.FeatureFlag, exception.EntityType);
        Assert.Null(exception.EntityId);
        Assert.Equal("key", exception.PropertyPath);
    }

    [Fact]
    public void Parse_InvalidSegmentJson_ThrowsWithSegmentContextAndOriginalError()
    {
        var reader = EntityJsonReader.ForSegment(SegmentId);
        var bytes = Encoding.UTF8.GetBytes("{");

        var exception = Assert.Throws<MalformedDataException>(() => reader.Parse(bytes));

        Assert.Equal(EvaluationEntityType.Segment, exception.EntityType);
        Assert.Equal(SegmentId, exception.EntityId);
        Assert.IsAssignableFrom<JsonException>(exception.InnerException);
    }

    [Fact]
    public void Parse_InvalidFlagJson_ThrowsWithFlagContext()
    {
        var bytes = Encoding.UTF8.GetBytes("{");

        var exception = Assert.Throws<MalformedDataException>(
            () => EntityJsonReader.FeatureFlag.Parse(bytes)
        );

        Assert.Equal(EvaluationEntityType.FeatureFlag, exception.EntityType);
        Assert.Null(exception.EntityId);
        Assert.IsAssignableFrom<JsonException>(exception.InnerException);
    }

    [Fact]
    public void GetRequiredArray_WrongSegmentPropertyType_ThrowsWithPropertyPath()
    {
        var reader = EntityJsonReader.ForSegment(SegmentId);
        var json = Parse("""{"rules":{}}""");

        var exception = Assert.Throws<MalformedDataException>(
            () => reader.GetRequiredArray(json, "rules")
        );

        Assert.Equal(EvaluationEntityType.Segment, exception.EntityType);
        Assert.Equal(SegmentId, exception.EntityId);
        Assert.Equal("rules", exception.PropertyPath);
    }

    [Fact]
    public void GetRequiredStringValue_NumberInSegment_ThrowsWithElementPath()
    {
        var reader = EntityJsonReader.ForSegment(SegmentId);
        var json = Parse("1");

        var exception = Assert.Throws<MalformedDataException>(
            () => reader.GetRequiredStringValue(json, "included[0]")
        );

        Assert.Equal(EvaluationEntityType.Segment, exception.EntityType);
        Assert.Equal(SegmentId, exception.EntityId);
        Assert.Equal("included[0]", exception.PropertyPath);
    }

    [Fact]
    public void DeserializeRequiredArray_NullElement_ThrowsWithPropertyPath()
    {
        var json = Parse("""{"variations":[null]}""");

        var exception = Assert.Throws<MalformedDataException>(
            () => EntityJsonReader.FeatureFlag.DeserializeRequiredArray<Variation>(json, "variations")
        );

        Assert.Equal(EvaluationEntityType.FeatureFlag, exception.EntityType);
        Assert.Equal("variations", exception.PropertyPath);
    }

    [Theory]
    [InlineData("not-a-guid")]
    [InlineData("(0779d76b-afc6-4886-ab65-af8c004273ad)")]
    [InlineData(" 0779d76b-afc6-4886-ab65-af8c004273ad")]
    public void DeserializeSegmentIds_NonCanonicalGuid_ThrowsWithPropertyPath(string segmentId)
    {
        var exception = Assert.Throws<MalformedDataException>(
            () => EntityJsonReader.FeatureFlag.DeserializeSegmentIds($"[\"{segmentId}\"]", "value")
        );

        Assert.Equal(EvaluationEntityType.FeatureFlag, exception.EntityType);
        Assert.Equal("value", exception.PropertyPath);
    }

    private static JsonElement Parse(string json) => JsonDocument.Parse(json).RootElement.Clone();
}
