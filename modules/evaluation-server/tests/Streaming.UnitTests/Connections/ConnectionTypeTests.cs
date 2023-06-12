using Streaming.Connections;

namespace Streaming.UnitTests.Connections;

public class ConnectionTypeTests
{
    [Theory]
    [InlineData("client", true)]
    [InlineData("server", true)]
    [InlineData("another", false)]
    [InlineData(" ", false)]
    [InlineData(null, false)]
    public void Should_Check_SdkType_Registration_Status(string type, bool registered)
    {
        Assert.Equal(registered, ConnectionType.IsRegistered(type));
    }
}