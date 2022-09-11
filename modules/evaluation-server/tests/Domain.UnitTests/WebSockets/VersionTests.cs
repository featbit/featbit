using Version = Domain.WebSockets.Version;

namespace Domain.UnitTests.WebSockets;

public class VersionTests
{
    [Theory]
    [InlineData("1", true)]
    [InlineData("", true)] // null/whitespace string equals V1
    [InlineData("2", true)]
    [InlineData("3", false)]
    public void Should_Check_Supported_Version(string version, bool supported)
    {
        Assert.Equal(supported, Version.IsSupported(version));
    }
}