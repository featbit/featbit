namespace FeatBit.Observability.Tests;

/// <summary>
/// Serializes the instrument tests against each other.
/// </summary>
/// <remarks>
/// <para>
/// These classes share process-wide state that cannot be isolated per test: the
/// <c>MessagingMetrics</c> / <c>PropagationMetrics</c> singletons, the global
/// <c>ActivitySource</c>, and <c>TraceGate.Current</c>. xUnit runs test classes in parallel by
/// default, so without this collection one class's spans and measurements land in another's
/// assertions — which is exactly how the fan-out span test first failed, having collected a
/// concurrently-running class's span alongside its own.
/// </para>
/// <para>
/// Serializing them is the correct fix rather than loosening the assertions: the point of these
/// tests is to prove that exactly one span and exactly one measurement are emitted per operation,
/// and an assertion relaxed to "at least one" would no longer catch a double-count.
/// </para>
/// </remarks>
[CollectionDefinition(Name, DisableParallelization = true)]
public sealed class ObservabilityCollection
{
    public const string Name = "Observability instruments";
}
