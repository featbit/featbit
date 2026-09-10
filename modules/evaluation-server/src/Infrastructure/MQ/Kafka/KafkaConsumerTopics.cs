using Domain.Messages;
using Microsoft.Extensions.Configuration;

namespace Infrastructure.MQ.Kafka;

/// <summary>
/// The single definition of the topics <see cref="KafkaMessageConsumer"/> subscribes to.
/// </summary>
/// <remarks>
/// The list is configuration-dependent — the control-plane command topic exists only when this
/// service is deployed behind a control plane — which is exactly why it needs one definition. The
/// backlog gauge reports lag for these topics, and a gauge watching a different set from the
/// consumer is worse than no gauge: it would report a drained queue for a topic nobody is
/// consuming.
/// </remarks>
public static class KafkaConsumerTopics
{
    public static string[] For(IConfiguration configuration) =>
        configuration.UseControlPlane()
            ? [Topics.FeatureFlagChange, Topics.SegmentChange, Topics.ControlPlaneCommand]
            : [Topics.FeatureFlagChange, Topics.SegmentChange];
}
