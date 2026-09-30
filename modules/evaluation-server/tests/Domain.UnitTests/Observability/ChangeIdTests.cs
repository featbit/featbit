using System.Text.Json;
using Domain.Observability;

namespace Domain.UnitTests.Observability;

/// <summary>
/// The evaluation server derives change identifiers from the JSON it consumes, while the API derives
/// them from its in-memory entities. The two services carry independent copies of
/// <see cref="ChangeId"/>, so these tests exercise this module's copy directly, and the golden-value
/// test below pins the exact algorithm so the copies cannot drift apart unnoticed.
/// </summary>
public sealed class ChangeIdTests
{
    private static readonly Guid EnvId = Guid.Parse("11111111-2222-3333-4444-555555555555");

    /// <summary>
    /// Fixed expected value for a fixed input. Both modules assert the same constant: if either
    /// copy's hashing, field order, or separator changes, cross-service correlation breaks silently
    /// in production but loudly here.
    /// </summary>
    private const string GoldenId = "2cf611a893f3049b";

    private static readonly DateTime GoldenUpdatedAt =
        new(2024, 3, 1, 12, 34, 56, 789, DateTimeKind.Utc);

    [Fact]
    public void For_WithTheFixedGoldenInput_MatchesTheCrossModuleValue()
    {
        Assert.Equal(GoldenId, ChangeId.For(ChangeId.FlagResource, EnvId, "my-flag", GoldenUpdatedAt));
    }

    [Fact]
    public void FromJson_WithTheFixedGoldenInput_MatchesTheCrossModuleValue()
    {
        // The payload shape the API's message producers emit for a flag change.
        using var document = JsonDocument.Parse(
            $$"""{"id":"{{Guid.NewGuid()}}","envId":"{{EnvId}}","key":"my-flag","name":"My Flag","updatedAt":"2024-03-01T12:34:56.789Z"}""");

        Assert.Equal(GoldenId, ChangeId.FromJson(document.RootElement, ChangeId.FlagResource));
    }

    [Fact]
    public void For_WithTheSameInput_IsDeterministic()
    {
        var first = ChangeId.For(ChangeId.FlagResource, EnvId, "my-flag", 1_700_000_000_000);
        var second = ChangeId.For(ChangeId.FlagResource, EnvId, "my-flag", 1_700_000_000_000);

        Assert.Equal(first, second);
    }

    [Fact]
    public void For_ForAnyInput_ProducesAFixedLengthLowercaseHexString()
    {
        var id = ChangeId.For(ChangeId.FlagResource, EnvId, "my-flag", 1);

        Assert.Equal(ChangeId.Length, id.Length);
        Assert.All(id, c => Assert.True(Uri.IsHexDigit(c) && !char.IsUpper(c), $"unexpected character '{c}'"));
    }

    [Theory]
    [InlineData(ChangeId.SegmentResource, "11111111-2222-3333-4444-555555555555", "my-flag", 1L)]
    [InlineData(ChangeId.FlagResource, "99999999-2222-3333-4444-555555555555", "my-flag", 1L)]
    [InlineData(ChangeId.FlagResource, "11111111-2222-3333-4444-555555555555", "other-flag", 1L)]
    [InlineData(ChangeId.FlagResource, "11111111-2222-3333-4444-555555555555", "my-flag", 2L)]
    public void For_WhenAnyFieldChanges_ProducesADifferentIdentifier(string resourceType, string envId, string key, long version)
    {
        var baseline = ChangeId.For(ChangeId.FlagResource, EnvId, "my-flag", 1L);
        var other = ChangeId.For(resourceType, Guid.Parse(envId), key, version);

        Assert.NotEqual(baseline, other);
    }

    [Fact]
    public void For_WithFieldsShiftedAcrossTheBoundary_DoesNotCollide()
    {
        // Without a separator, ("ab", 1) and ("a", 12) would concatenate to the same material.
        Assert.NotEqual(
            ChangeId.For(ChangeId.FlagResource, EnvId, "ab", 1),
            ChangeId.For(ChangeId.FlagResource, EnvId, "a", 12));
    }

    [Fact]
    public void For_TreatsTheSameInstantIdentically_RegardlessOfDateTimeKind()
    {
        // The API may hold Utc while this service holds Local or Unspecified after a JSON round trip.
        // If those produced different identifiers, correlation would silently fail.
        var unspecified = DateTime.SpecifyKind(GoldenUpdatedAt, DateTimeKind.Unspecified);
        var local = GoldenUpdatedAt.ToLocalTime();

        Assert.Equal(GoldenId, ChangeId.For(ChangeId.FlagResource, EnvId, "my-flag", unspecified));
        Assert.Equal(GoldenId, ChangeId.For(ChangeId.FlagResource, EnvId, "my-flag", local));
    }

    [Fact]
    public void FromJson_WithATimestampWrittenWithAnOffset_StillMatches()
    {
        // Serializers differ in how they render the instant; the identifier must not.
        using var document = JsonDocument.Parse(
            $$"""{"envId":"{{EnvId}}","key":"my-flag","updatedAt":"2024-03-01T14:34:56.789+02:00"}""");

        Assert.Equal(GoldenId, ChangeId.FromJson(document.RootElement, ChangeId.FlagResource));
    }

    [Fact]
    public void FromJson_ReturnsNull_WhenTheResourceCannotBeIdentified()
    {
        // Correlation is best-effort. A payload that cannot be identified must not throw, because the
        // message still has to be delivered.
        Assert.Null(Parse("""{"key":"my-flag","updatedAt":"2024-03-01T12:34:56Z"}"""));
        Assert.Null(Parse($$"""{"envId":"{{EnvId}}","key":"my-flag"}"""));
        Assert.Null(Parse("""{"envId":"not-a-guid","key":"k","updatedAt":"2024-03-01T12:34:56Z"}"""));
        Assert.Null(Parse($$"""{"envId":"{{EnvId}}","key":"k","updatedAt":"not-a-date"}"""));
        Assert.Null(Parse("[]"));
        Assert.Null(Parse("null"));

        static string? Parse(string json)
        {
            using var document = JsonDocument.Parse(json);
            return ChangeId.FromJson(document.RootElement, ChangeId.FlagResource);
        }
    }

    [Fact]
    public void FromJson_WithAMissingKey_StillProducesAnIdentifier()
    {
        // envId and updatedAt alone still identify the change well enough to be useful.
        using var document = JsonDocument.Parse(
            $$"""{"envId":"{{EnvId}}","updatedAt":"2024-03-01T12:34:56Z"}""");

        var id = ChangeId.FromJson(document.RootElement, ChangeId.FlagResource);

        Assert.NotNull(id);
        Assert.Equal(ChangeId.Length, id!.Length);
    }

    [Fact]
    public void New_CalledRepeatedly_ProducesDistinctIdentifiersOfTheStandardLength()
    {
        var ids = Enumerable.Range(0, 100).Select(_ => ChangeId.New()).ToArray();

        Assert.All(ids, id => Assert.Equal(ChangeId.Length, id.Length));
        Assert.Equal(ids.Length, ids.Distinct().Count());
    }
}
