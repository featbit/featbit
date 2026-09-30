using System.Text.Json;
using Domain.FeatureFlags;
using Domain.Observability;
using Domain.Segments;
using Domain.Utils;

namespace Domain.UnitTests.Observability;

/// <summary>
/// The change identifier is derived rather than carried on the wire, which is only worth anything if
/// the producing and consuming services derive the <i>same</i> value from their own copies of the
/// data. These tests pin that agreement, including the cases where it deliberately does not hold.
/// </summary>
public sealed class ChangeIdTests
{
    private static readonly Guid EnvId = Guid.Parse("11111111-2222-3333-4444-555555555555");
    private static readonly Guid OtherEnvId = Guid.Parse("99999999-2222-3333-4444-555555555555");

    /// <summary>
    /// Fixed expected value for a fixed input. The evaluation server asserts the same constant
    /// against its own copy of <see cref="ChangeId"/>: if either copy's hashing, field order, or
    /// separator changes, cross-service correlation breaks silently in production but loudly here.
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
        // Without a separator, ("ab", 1) and ("a", "b1") would concatenate to the same material.
        var first = ChangeId.For(ChangeId.FlagResource, EnvId, "ab", 1);
        var second = ChangeId.For(ChangeId.FlagResource, EnvId, "a", 12) /* "a" + "12" */;

        Assert.NotEqual(first, second);
    }

    [Fact]
    public void For_TreatsTheSameInstantIdentically_RegardlessOfDateTimeKind()
    {
        // A producer holds Utc; a consumer that parsed the value back out of JSON may hold Local or
        // Unspecified. If those produced different identifiers, correlation would silently fail.
        var utc = new DateTime(2024, 3, 1, 12, 34, 56, 789, DateTimeKind.Utc);
        var unspecified = DateTime.SpecifyKind(utc, DateTimeKind.Unspecified);
        var local = utc.ToLocalTime();

        var fromUtc = ChangeId.For(ChangeId.FlagResource, EnvId, "my-flag", utc);
        var fromUnspecified = ChangeId.For(ChangeId.FlagResource, EnvId, "my-flag", unspecified);
        var fromLocal = ChangeId.For(ChangeId.FlagResource, EnvId, "my-flag", local);

        Assert.Equal(fromUtc, fromUnspecified);
        Assert.Equal(fromUtc, fromLocal);
    }

    [Fact]
    public void For_TimestampOverload_AgreesWithTheVersionOverload()
    {
        var utc = new DateTime(2024, 3, 1, 12, 34, 56, 789, DateTimeKind.Utc);
        var unixMs = new DateTimeOffset(utc).ToUnixTimeMilliseconds();

        Assert.Equal(
            ChangeId.For(ChangeId.FlagResource, EnvId, "my-flag", unixMs),
            ChangeId.For(ChangeId.FlagResource, EnvId, "my-flag", utc));
    }

    [Fact]
    public void For_ForAFlagChange_DerivesTheSameIdentifierOnProducerAndConsumer()
    {
        // This is the claim the whole design rests on. The API derives the identifier from the
        // in-memory entity; the evaluation server derives it from the JSON it receives. Both must
        // agree without anything being added to the message.
        var flag = new FeatureFlag
        {
            EnvId = EnvId,
            Key = "my-flag",
            Name = "My Flag",
            UpdatedAt = new DateTime(2024, 3, 1, 12, 34, 56, 789, DateTimeKind.Utc)
        };

        var producerId = ChangeId.For(ChangeId.FlagResource, flag.EnvId, flag.Key, flag.UpdatedAt);

        // Exactly how the message producers serialize the payload.
        var json = JsonSerializer.Serialize(flag, ReusableJsonSerializerOptions.Web);
        using var document = JsonDocument.Parse(json);
        var consumerId = ChangeId.FromJson(document.RootElement, ChangeId.FlagResource);

        Assert.Equal(producerId, consumerId);
    }

    [Fact]
    public void For_ForAnEnvironmentSpecificSegmentChange_DerivesTheSameIdentifierOnBothSides()
    {
        var segment = new Segment
        {
            EnvId = EnvId,
            Key = "my-segment",
            Name = "My Segment",
            Type = SegmentType.EnvironmentSpecific,
            UpdatedAt = new DateTime(2024, 3, 1, 12, 34, 56, 789, DateTimeKind.Utc)
        };

        var producerId = ChangeId.For(ChangeId.SegmentResource, segment.EnvId, segment.Key, segment.UpdatedAt);

        // The segment payload is built by SerializeAsEnvironmentSpecific, not by plain serialization.
        var node = segment.SerializeAsEnvironmentSpecific(EnvId);
        using var document = JsonDocument.Parse(node.ToJsonString());
        var consumerId = ChangeId.FromJson(document.RootElement, ChangeId.SegmentResource);

        Assert.Equal(producerId, consumerId);
    }

    [Fact]
    public void For_ForASharedSegmentChange_DerivesAPerEnvironmentIdentifierOnTheConsumer()
    {
        // A shared segment fans out to one message per environment, each with envId rewritten to the
        // target environment. The consumer therefore derives a per-environment identifier that does
        // not equal the producer's. This is pinned rather than assumed: the per-environment value is
        // the more precise one, and it still correlates the stages that handle that fan-out.
        var segment = new Segment
        {
            EnvId = EnvId,
            Key = "shared-segment",
            Name = "Shared Segment",
            Type = SegmentType.Shared,
            UpdatedAt = new DateTime(2024, 3, 1, 12, 34, 56, 789, DateTimeKind.Utc)
        };

        var producerId = ChangeId.For(ChangeId.SegmentResource, segment.EnvId, segment.Key, segment.UpdatedAt);

        var node = segment.SerializeAsEnvironmentSpecific(OtherEnvId);
        using var document = JsonDocument.Parse(node.ToJsonString());
        var consumerId = ChangeId.FromJson(document.RootElement, ChangeId.SegmentResource);

        Assert.NotEqual(producerId, consumerId);
        Assert.Equal(
            ChangeId.For(ChangeId.SegmentResource, OtherEnvId, segment.Key, segment.UpdatedAt),
            consumerId);
    }

    [Fact]
    public void FromJson_ReturnsNull_WhenTheResourceCannotBeIdentified()
    {
        // Correlation is best-effort. A payload that cannot be identified must not throw, because
        // the message still has to be delivered.
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
        using var document = JsonDocument.Parse($$"""{"envId":"{{EnvId}}","updatedAt":"2024-03-01T12:34:56Z"}""");

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
