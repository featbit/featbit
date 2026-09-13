using Confluent.Kafka;
using Infrastructure.MQ.Kafka;
using TestBase;

namespace Infrastructure.UnitTests.MQ;

public class KafkaLagReaderLogTests
{
    [Fact]
    public void ReaderReportedError_StructuredErrorCode_PreservesClrType()
    {
        var logger = new TypedFakeLogger<KafkaLagReader>();

        KafkaLagReader.Log.ReaderReportedError(logger, ErrorCode.Local_AllBrokersDown);

        var value = logger.GetStructuredStateValue("ErrorCode");
        var capturedErrorCode = Assert.IsType<ErrorCode>(value);
        Assert.Equal(ErrorCode.Local_AllBrokersDown, capturedErrorCode);
    }
}
