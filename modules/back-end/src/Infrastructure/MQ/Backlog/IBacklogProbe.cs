namespace Infrastructure.MQ.Backlog;

/// <summary>
/// Reads how many messages are waiting to be consumed, for one transport.
/// </summary>
/// <remarks>
/// <para>
/// Implementations are called only from <see cref="MessagingBacklogSampler"/>, on a background
/// timer. Nothing on a request, streaming, or evaluation path may call one: every implementation
/// issues real I/O against a production datastore, which is precisely why backlog depth was left
/// unmeasured until there was somewhere safe to do it from.
/// </para>
/// <para>
/// An implementation must not throw for an ordinary operational problem — an unreachable broker, a
/// missing topic, a statement timeout. It should omit that topic from the returned map instead, and
/// the sampler will report the depth as unknown rather than as zero. Reporting an unknown backlog
/// as zero is the worst available outcome: it is indistinguishable from a healthy drained queue and
/// would silence exactly the alert this instrument exists to raise.
/// </para>
/// </remarks>
public interface IBacklogProbe
{
    /// <summary>
    /// Transport name, from <c>MessagingSystems</c>. Becomes the gauge's <c>provider</c> attribute.
    /// </summary>
    string Provider { get; }

    /// <summary>
    /// The topics this probe reports on. Fixed at construction so the gauge set is bounded and
    /// known at startup — a probe that discovered topics dynamically could grow cardinality
    /// without limit.
    /// </summary>
    IReadOnlyList<string> Topics { get; }

    /// <summary>
    /// Samples current depth per topic.
    /// </summary>
    /// <returns>
    /// Depth by topic. A topic absent from the result is reported as unknown (<c>-1</c>), not zero.
    /// </returns>
    Task<IReadOnlyDictionary<string, long>> SampleAsync(CancellationToken cancellationToken);
}
