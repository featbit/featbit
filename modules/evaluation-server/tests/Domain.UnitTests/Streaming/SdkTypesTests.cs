using Domain.Streaming;

namespace Domain.UnitTests.Streaming;

public class SdkTypesTests
{
    [Theory]
    [InlineData("client", true)]
    [InlineData("server", true)]
    [InlineData("another", false)]
    [InlineData(" ", false)]
    [InlineData(null, false)]
    public void Should_Check_SdkType_Registration_Status(string type, bool registered)
    {
        Assert.Equal(registered, SdkTypes.IsRegistered(type));
    }
}