using Confluent.Kafka;
using Infrastructure.MQ.Kafka;
using TestBase;

namespace Infrastructure.UnitTests.MQ;

public class KafkaMessageProducerLogTests
{
    [Fact]
    public void ErrorDeliveryMessage_StructuredError_PreservesClrType()
    {
        var logger = new TypedFakeLogger<KafkaMessageProducer>();
        var error = new Error(ErrorCode.Local_MsgTimedOut);

        KafkaMessageProducer.Log.ErrorDeliveryMessage(logger, "topic", "{\"id\":\"flag-1\"}", error);

        var value = logger.GetStructuredStateValue("Error");
        var capturedError = Assert.IsType<Error>(value);
        Assert.Equal(error.Code, capturedError.Code);
    }
}
