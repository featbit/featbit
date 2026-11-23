using Streaming.ControlPlane;

namespace Streaming.UnitTests.ControlPlane;

public class NoOpAppliedWatermarkReaderTests
{
    [Fact]
    public async Task ReadAsync_Always_ReturnsNoWatermarks()
    {
        var sut = new NoOpAppliedWatermarkReader();

        var watermarks = await sut.ReadAsync(CancellationToken.None);

        Assert.Empty(watermarks);
    }

    [Fact]
    public async Task ReadAsync_CalledTwice_ReturnsIndependentDictionaries()
    {
        var sut = new NoOpAppliedWatermarkReader();

        var first = await sut.ReadAsync(CancellationToken.None);
        first[Guid.NewGuid()] = 1;
        var second = await sut.ReadAsync(CancellationToken.None);

        Assert.Empty(second);
    }
}
