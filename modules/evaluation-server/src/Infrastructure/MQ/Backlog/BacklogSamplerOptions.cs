using Microsoft.Extensions.Configuration;

namespace Infrastructure.MQ.Backlog;

/// <summary>
/// How often <see cref="MessagingBacklogSampler"/> queries the message-queue backing store.
/// </summary>
/// <remarks>
/// <para>
/// The sampler is the one piece of this observability work that adds real runtime behavior — a
/// periodic query against production Redis, Postgres, or Kafka — so it is configurable and can be
/// switched off outright. An operator who decides the query is too expensive for their deployment
/// must be able to stop it without redeploying a different build.
/// </para>
/// <para>
/// Configuration lives under <c>Observability:Messaging</c> alongside the other observability
/// settings, so it is reachable from <c>appsettings.json</c>, user secrets, command-line arguments,
/// or an <c>Observability__Messaging__BacklogSampleIntervalSeconds</c> environment variable.
/// </para>
/// </remarks>
public static class BacklogSamplerOptions
{
    /// <summary>Configuration key holding the sample interval, in seconds. <c>0</c> disables.</summary>
    public const string IntervalKey = "Observability:Messaging:BacklogSampleIntervalSeconds";

    /// <summary>
    /// Reads the configured interval.
    /// </summary>
    /// <returns>
    /// The interval to sample at, or <c>null</c> when sampling is disabled. An absent or
    /// unparseable value yields <see cref="MessagingBacklogSampler.DefaultInterval"/> — a
    /// mistyped setting must not silently turn a diagnostic off.
    /// </returns>
    public static TimeSpan? Resolve(IConfiguration configuration)
    {
        var raw = configuration[IntervalKey];

        if (string.IsNullOrWhiteSpace(raw) || !int.TryParse(raw, out var seconds))
        {
            return MessagingBacklogSampler.DefaultInterval;
        }

        return seconds <= 0 ? null : TimeSpan.FromSeconds(seconds);
    }
}
