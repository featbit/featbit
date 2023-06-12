using Streaming.Shared;

namespace Streaming.UnitTests.Shared;

public class GuidHelperTests
{
    [Fact]
    public void EncodeAndDecode()
    {
        var guid = new Guid("7dfd851b-6256-44b5-a7b6-bca2d126834b");
        var encoded = GuidHelper.Encode(guid);
        Assert.NotNull(encoded);
        Assert.Equal(22, encoded.Length);

        var decoded = GuidHelper.Decode(encoded);
        Assert.Equal(guid, decoded);
    }
}