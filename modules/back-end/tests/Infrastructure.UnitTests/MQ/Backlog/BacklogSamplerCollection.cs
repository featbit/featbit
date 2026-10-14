namespace Infrastructure.UnitTests.MQ.Backlog;

/// <summary>
/// Serializes the backlog-sampler tests against each other.
/// </summary>
/// <remarks>
/// Every sampler instance registers observable gauges on the process-wide
/// <c>MessagingMetrics.Current</c> meter, and those registrations are never removed — a
/// <c>MeterListener</c> started by one test therefore sees gauges left behind by every other. The
/// tests additionally tag with provider and topic values unique to this file, but serializing them
/// is what makes an exact-count assertion meaningful rather than merely usually true.
/// </remarks>
[CollectionDefinition(nameof(BacklogSamplerCollection), DisableParallelization = true)]
public sealed class BacklogSamplerCollection;
