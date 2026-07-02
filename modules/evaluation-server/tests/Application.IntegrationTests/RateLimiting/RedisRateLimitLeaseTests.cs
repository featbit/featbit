using System.Threading.RateLimiting;
using Api.RateLimiting;

namespace Application.IntegrationTests.RateLimiting;

public class RedisRateLimitLeaseTests
{
    [Fact]
    public void RejectedLease_ExposesRetryAfterMetadata()
    {
        var retryAfterName = MetadataName.RetryAfter.Name;

        var lease = new RedisRateLimitLease(isAcquired: false, retryAfter: TimeSpan.FromSeconds(7));
        Assert.False(lease.IsAcquired);
        Assert.Contains(retryAfterName, lease.MetadataNames);

        var hasMetadata = lease.TryGetMetadata(MetadataName.RetryAfter, out var metadata);
        Assert.True(hasMetadata);
        Assert.Equal(TimeSpan.FromSeconds(7), metadata);

        var allMetadata = lease.GetAllMetadata().ToDictionary(x => x.Key, x => x.Value);
        Assert.True(allMetadata.ContainsKey(retryAfterName));
    }

    [Fact]
    public void AcquiredLease_HasNoRetryAfterMetadata()
    {
        var lease = new RedisRateLimitLease(isAcquired: true);

        Assert.True(lease.IsAcquired);
        Assert.Empty(lease.MetadataNames);

        var hasMetadata = lease.TryGetMetadata(MetadataName.RetryAfter, out var metadata);

        Assert.False(hasMetadata);
        Assert.Equal(TimeSpan.Zero, metadata);
        Assert.Empty(lease.GetAllMetadata());
    }
}