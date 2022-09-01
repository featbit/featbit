using Domain.Utils.ExtensionMethods;

namespace Domain.UnitTests.Utils;

public class DateTimeExtensionTests
{
    [Fact]
    public void Should_Get_Timestamp_In_MillionSeconds()
    {
        var time = DateTime.Parse("2022-09-01 08:00:00");
        
        Assert.Equal(1661990400000, time.ToUnixTimeMilliseconds());
    }
}