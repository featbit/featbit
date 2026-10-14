using Domain.Messages;

namespace Domain.UnitTests.Messages;

public class TopicsTests
{
    // These literals are duplicated from the evaluation server on purpose. The two modules cannot
    // reference each other, so the LISTEN/NOTIFY channel names are a hand-maintained contract:
    // the producer here calls pg_notify on these, and the evaluation server's consumer issues
    // LISTEN on the same strings. Pinning them on both sides is what stops a rename on one side
    // from silently severing delivery — the failure mode is a message that is written, counted as
    // published, and never consumed.
    [Theory]
    [InlineData(Topics.FeatureFlagChange, "featbit_feature_flag_change_channel")]
    [InlineData(Topics.SegmentChange, "featbit_segment_change_channel")]
    [InlineData(ControlPlaneTopics.ControlPlaneCommand, "featbit_control_plane_command_channel")]
    public void ToChannel_NotificationTopic_ReturnsChannelTheEvaluationServerListensOn(
        string topic,
        string expectedChannel)
    {
        var channel = Topics.ToChannel(topic);

        Assert.Equal(expectedChannel, channel);
    }

    [Fact]
    public void ToChannel_ControlPlaneCommand_DoesNotThrow()
    {
        // The control plane publishes this topic and the evaluation server subscribes over LISTEN,
        // so the producer must be able to resolve a channel for it. When it could not, the publish
        // path left the row Pending with no notification and the command was never delivered under
        // Postgres, while working normally on Redis and Kafka.
        var exception = Record.Exception(() => Topics.ToChannel(ControlPlaneTopics.ControlPlaneCommand));

        Assert.Null(exception);
    }

    [Fact]
    public void ToChannel_UnknownTopic_Throws()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => Topics.ToChannel("not-a-topic"));
    }

    [Fact]
    public void Consumed_DoesNotContainControlPlaneCommand()
    {
        // The control plane publishes this topic rather than consuming it; if it ever appears in
        // Consumed, the Redis routing table would treat it as a list and the evaluation server's
        // subscription would stop receiving it.
        Assert.DoesNotContain(ControlPlaneTopics.ControlPlaneCommand, ControlPlaneTopics.Consumed);
    }
}
