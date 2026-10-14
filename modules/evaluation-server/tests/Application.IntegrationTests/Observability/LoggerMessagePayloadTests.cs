using FeatBit.Observability.TestKit;

namespace Application.IntegrationTests.Observability;

/// <remarks>
/// Uses the shared <see cref="LoggerMessagePayloadGuard"/> rather than a module-local parser, so
/// all three modules enforce the same rule with the same implementation. The allowances below are
/// declared explicitly instead of being matched by a heuristic: the guard fails when an allowance
/// stops being used, so a coercion that is removed cannot leave a stale exemption behind that
/// silently permits a future one.
/// </remarks>
[Trait("Category", "Host")]
public class LoggerMessagePayloadTests
{
    private static readonly LoggerMessageToStringAllowance[] ToStringAllowances =
    [
        // StackExchange.Redis.RedisChannel is a channel-name value object whose ToString() is the
        // channel name itself. The generated parameter is intentionally string, so no scalar
        // identifier is being flattened to hide a parameter-type mismatch.
        new(
            @"modules\evaluation-server\src\Infrastructure\MQ\Redis\RedisMessageConsumer.cs",
            "StartConsumingDataChange",
            "channel.ToString()",
            "Redis channel name value object rendered as its channel-name string."),
        new(
            @"modules\evaluation-server\src\Infrastructure\MQ\Redis\RedisMessageConsumer.cs",
            "StartConsumingControlPlaneCommand",
            "controlPlaneCommandChannel.ToString()",
            "Redis channel name value object rendered as its channel-name string.")
    ];

    [Fact]
    public void LogInvocations_WithToStringArgumentCoercion_DoNotExist()
    {
        // Arrange
        var repositoryRoot = LoggerMessagePayloadGuard.LocateRepositoryRoot(GetType());

        // Act
        var result = LoggerMessagePayloadGuard.ScanModule(
            repositoryRoot,
            Path.Combine("modules", "evaluation-server"),
            ToStringAllowances);

        // Assert
        Assert.True(
            result.Allowed.Count == ToStringAllowances.Length,
            LoggerMessagePayloadGuard.FormatUnusedAllowances(ToStringAllowances, result.Allowed));
        Assert.True(result.Disallowed.Count == 0, LoggerMessagePayloadGuard.FormatFailures(result.Disallowed));
    }
}
