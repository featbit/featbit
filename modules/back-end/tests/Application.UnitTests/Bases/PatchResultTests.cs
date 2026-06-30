using Application.Bases.Models;

namespace Application.UnitTests.Bases;

public class PatchResultTests
{
    [Fact]
    public void Ok_Always_ReturnsSuccessfulResultWithEmptyMessage()
    {
        var result = PatchResult.Ok();

        Assert.True(result.Success);
        Assert.Equal(string.Empty, result.Message);
    }

    [Fact]
    public void Fail_Always_ReturnsFailedResultWithProvidedMessage()
    {
        var result = PatchResult.Fail("boom");

        Assert.False(result.Success);
        Assert.Equal("boom", result.Message);
    }
}
