using Domain.Shared;

namespace Domain.UnitTests.Shared;

public class GuidHelperTests
{
    [Fact]
    public void Encode_AnyGuid_Returns22CharString()
    {
        var guid = new Guid("7dfd851b-6256-44b5-a7b6-bca2d126834b");

        var encoded = GuidHelper.Encode(guid);

        Assert.NotNull(encoded);
        Assert.Equal(22, encoded.Length);
    }

    [Fact]
    public void Decode_EncodedGuid_RoundTripsToOriginal()
    {
        var guid = new Guid("7dfd851b-6256-44b5-a7b6-bca2d126834b");
        var encoded = GuidHelper.Encode(guid);

        var decoded = GuidHelper.Decode(encoded);

        Assert.Equal(guid, decoded);
    }
}
