using Infrastructure.MQ.Postgres;
using TestBase;

namespace Infrastructure.UnitTests.MQ;

public class PostgresMessageConsumerLogTests
{
    [Fact]
    public void MessageHandled_StructuredId_PreservesClrType()
    {
        var logger = new TypedFakeLogger<PostgresMessageConsumer>();

        PostgresMessageConsumer.Log.MessageHandled(logger, 1234567890123L);

        Assert.IsType<long>(logger.GetStructuredStateValue("Id"));
    }

    [Fact]
    public void ListenStoppedDueToStartError_StructuredRestartInterval_PreservesClrType()
    {
        var logger = new TypedFakeLogger<PostgresMessageConsumer>();

        PostgresMessageConsumer.Log.ListenStoppedDueToStartError(logger, restartIntervalInSeconds: 5);

        Assert.IsType<int>(logger.GetStructuredStateValue("RestartIntervalInSeconds"));
    }
}
