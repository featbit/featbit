using Api.Application.ControlPlane;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Testing;

namespace Api.UnitTests.Observability;

public class LoggerMessagePayloadTests
{
    [Fact]
    public void LogInvocations_WithToStringArgumentCoercion_DoNotExist()
    {
        var repositoryRoot = LoggerMessagePayloadGuard.LocateRepositoryRoot(GetType());

        var result = LoggerMessagePayloadGuard.ScanModule(
            repositoryRoot,
            Path.Combine("modules", "control-plane"),
            Array.Empty<LoggerMessageToStringAllowance>());

        Assert.True(result.Disallowed.Count == 0, LoggerMessagePayloadGuard.FormatFailures(result.Disallowed));
    }

    [Fact]
    public void LeadershipAcquired_WithGuidInstanceId_CapturesInstanceIdAsGuid()
    {
        var logger = new CapturingFakeLogger<RedisLeaderElector>();
        var instanceId = Guid.NewGuid();

        RedisLeaderElector.Log.LeadershipAcquired(logger, instanceId);

        var value = StructuredValue(logger, "InstanceId");
        Assert.IsType<Guid>(value);
        Assert.Equal(instanceId, value);
    }

    [Fact]
    public void PodUnhealthy_WithDateTimeOffsetTimestamp_CapturesTimestampAsDateTimeOffset()
    {
        var logger = new CapturingFakeLogger<PodHealthChecker>();
        var timestamp = DateTimeOffset.UtcNow;

        PodHealthChecker.Log.PodUnhealthy(logger, "pod-1", timestamp);

        var value = StructuredValue(logger, "Timestamp");
        Assert.IsType<DateTimeOffset>(value);
        Assert.Equal(timestamp, value);
    }

    private static object? StructuredValue<T>(CapturingFakeLogger<T> logger, string name)
    {
        Assert.Single(logger.FakeLogger.Collector.GetSnapshot());
        var property = Assert.Single(logger.StructuredState, item => item.Key == name);

        return property.Value;
    }

    // FakeLogger's public StructuredState stores stringified values, so preserve the raw
    // ILogger<TState> payload before forwarding to FakeLogger for the normal log capture.
    private sealed class CapturingFakeLogger<T> : ILogger<T>
    {
        public FakeLogger<T> FakeLogger { get; } = new();

        public IReadOnlyList<KeyValuePair<string, object?>> StructuredState { get; private set; } = [];

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull
            => FakeLogger.BeginScope(state);

        public bool IsEnabled(LogLevel logLevel) => FakeLogger.IsEnabled(logLevel);

        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            StructuredState = state as IReadOnlyList<KeyValuePair<string, object?>> ?? [];
            FakeLogger.Log(logLevel, eventId, state, exception, formatter);
        }
    }
}
