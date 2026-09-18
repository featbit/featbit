using Domain.Messages;

namespace Domain.UnitTests.Messages;

public class TopicsTests
{
    [Theory]
    [InlineData(Topics.FeatureFlagChange)]
    [InlineData(Topics.SegmentChange)]
    [InlineData(Topics.ControlPlaneCommand)]
    public void FromChannel_ChannelOfKnownTopic_RoundTripsToOriginalTopic(string topic)
    {
        var channel = Topics.ToChannel(topic);

        var roundTripped = Topics.FromChannel(channel);

        Assert.Equal(topic, roundTripped);
    }

    [Theory]
    [InlineData(Topics.FeatureFlagChange)]
    [InlineData(Topics.SegmentChange)]
    [InlineData(Topics.ControlPlaneCommand)]
    public void ToChannel_KnownTopic_ReturnsChannelDistinctFromTopic(string topic)
    {
        var channel = Topics.ToChannel(topic);

        Assert.NotEqual(topic, channel);
    }

    [Fact]
    public void FromChannel_UnknownChannel_ReturnsInputUnchanged()
    {
        const string unknown = "featbit_something_nobody_registered_channel";

        var result = Topics.FromChannel(unknown);

        Assert.Equal(unknown, result);
    }

    [Fact]
    public void FromChannel_UnknownChannel_DoesNotThrow()
    {
        // Telemetry must never stop message delivery: an unroutable notification still has to be
        // recorded, so the inverse mapping degrades instead of throwing the way ToChannel does.
        var exception = Record.Exception(() => Topics.FromChannel("not-a-channel"));

        Assert.Null(exception);
    }

    [Fact]
    public void ToChannel_UnknownTopic_Throws()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => Topics.ToChannel("not-a-topic"));
    }
}
