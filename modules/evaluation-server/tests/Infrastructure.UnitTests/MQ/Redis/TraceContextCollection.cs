namespace Infrastructure.UnitTests.MQ.Redis;

/// <summary>
/// Serializes tests that mutate the process-wide activity listener.
/// </summary>
[CollectionDefinition(Name, DisableParallelization = true)]
public sealed class TraceContextCollection
{
    public const string Name = "Trace context";
}
