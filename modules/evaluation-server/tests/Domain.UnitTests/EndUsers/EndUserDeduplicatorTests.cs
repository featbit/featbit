using Domain.EndUsers;

namespace Domain.UnitTests.EndUsers;

public class EndUserDeduplicatorTests
{
    [Fact]
    public void TryMarkAsReported_DeduplicatesEachUserWithinItsEnvironment()
    {
        using var cache = new EndUserDeduplicator();
        var envId = Guid.NewGuid();

        Assert.True(cache.TryMarkAsReported(envId, "user-1"));
        Assert.False(cache.TryMarkAsReported(envId, "user-1"));
        Assert.True(cache.TryMarkAsReported(envId, "user-2"));
        Assert.True(cache.TryMarkAsReported(Guid.NewGuid(), "user-1"));
    }
}
