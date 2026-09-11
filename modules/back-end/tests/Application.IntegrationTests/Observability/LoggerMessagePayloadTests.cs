using FeatBit.Observability.TestKit;
using Infrastructure.Caches.Redis;
using Infrastructure.MQ.Postgres;
using Infrastructure.Services;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Testing;

namespace Application.IntegrationTests.Observability;

[Trait("Category", "Host")]
public class LoggerMessagePayloadTests
{
    private static readonly LoggerMessageToStringAllowance[] ToStringAllowances =
    [
        // Billing request DTOs override ToString() to produce the exact human-readable request
        // summary the Request log property is meant to carry; the generated parameter is
        // intentionally string and no scalar identifier is being coerced to hide a type mismatch.
        new(
            @"modules\back-end\src\Infrastructure\Services\BillingService.cs",
            "ErrorCreateSubscription",
            "request.ToString()",
            "Billing request DTO formatted as the logged Request string."),
        new(
            @"modules\back-end\src\Infrastructure\Services\BillingService.cs",
            "ErrorGetProrationPreview",
            "request.ToString()",
            "Billing request DTO formatted as the logged Request string."),
        new(
            @"modules\back-end\src\Infrastructure\Services\BillingService.cs",
            "ErrorUpgradeSubscription",
            "request.ToString()",
            "Billing request DTO formatted as the logged Request string."),
        new(
            @"modules\back-end\src\Infrastructure\Services\BillingService.cs",
            "ErrorDowngradeSubscription",
            "request.ToString()",
            "Billing request DTO formatted as the logged Request string."),

        // Confluent.Kafka.Error is deliberately flattened to its diagnostic text because the
        // event's Error property is operator-facing text, not a queryable domain id or number.
        new(
            @"modules\back-end\src\Infrastructure\MQ\Kafka\KafkaMessageProducer.cs",
            "ErrorDeliveryMessage",
            "report.Error.ToString()",
            "Kafka delivery Error is intentionally logged as diagnostic text."),
        new(
            @"modules\back-end\src\Infrastructure\MQ\Kafka\KafkaMessageProducer.cs",
            "ErrorDeliveryMessage",
            "ex.Error.ToString()",
            "Kafka produce Error is intentionally logged as diagnostic text.")
    ];

    [Fact]
    public void LogInvocations_WithToStringArgumentCoercion_DoNotExist()
    {
        var repositoryRoot = LoggerMessagePayloadGuard.LocateRepositoryRoot(GetType());

        var result = LoggerMessagePayloadGuard.ScanModule(
            repositoryRoot,
            Path.Combine("modules", "back-end"),
            ToStringAllowances);

        Assert.True(
            result.Allowed.Count == ToStringAllowances.Length,
            LoggerMessagePayloadGuard.FormatUnusedAllowances(ToStringAllowances, result.Allowed));
        Assert.True(result.Disallowed.Count == 0, LoggerMessagePayloadGuard.FormatFailures(result.Disallowed));
    }

    [Fact]
    public void ErrorGetSubscription_WithGuidWorkspaceId_CapturesWorkspaceIdAsGuid()
    {
        var logger = new CapturingFakeLogger<BillingService>();
        var workspaceId = Guid.NewGuid();

        BillingService.Log.ErrorGetSubscription(logger, workspaceId, new InvalidOperationException("boom"));

        var value = StructuredValue(logger, "WorkspaceId");
        Assert.IsType<Guid>(value);
        Assert.Equal(workspaceId, value);
    }

    [Fact]
    public void StartPopulate_WithDoubleLockTtl_CapturesLockTtlAsDouble()
    {
        var logger = new CapturingFakeLogger<RedisPopulatingService>();
        const double lockTtl = 12.5;

        RedisPopulatingService.Log.StartPopulate(logger, lockTtl);

        var value = StructuredValue(logger, "LockTtl");
        Assert.IsType<double>(value);
        Assert.Equal(lockTtl, value);
    }

    [Fact]
    public void MessageProcessed_WithLongId_CapturesIdAsLong()
    {
        var logger = new CapturingFakeLogger<PostgresMessageConsumer>();
        const long id = 9_223_372_036_854_775;

        PostgresMessageConsumer.Log.MessageProcessed(logger, id, "success", string.Empty);

        var value = StructuredValue(logger, "Id");
        Assert.IsType<long>(value);
        Assert.Equal(id, value);
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
