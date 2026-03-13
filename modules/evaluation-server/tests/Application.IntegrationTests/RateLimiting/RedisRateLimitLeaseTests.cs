using Api.RateLimiting;

namespace Application.IntegrationTests.RateLimiting;

public class RedisRateLimitLeaseTests
{
    [Fact]
    public void RejectedLease_ExposesRetryAfterMetadata()
    {
        var lease = new RedisRateLimitLease(isAcquired: false, retryAfter: TimeSpan.FromSeconds(7));

        Assert.False(lease.IsAcquired);
        Assert.Contains(RedisRateLimitLease.RetryAfterMetadataName, lease.MetadataNames);

        var hasMetadata = lease.TryGetMetadata(RedisRateLimitLease.RetryAfterMetadataName, out var metadata);

        Assert.True(hasMetadata);
        Assert.IsType<TimeSpan>(metadata);
        Assert.Equal(TimeSpan.FromSeconds(7), (TimeSpan)metadata!);

        var allMetadata = lease.GetAllMetadata().ToDictionary(x => x.Key, x => x.Value);
        Assert.True(allMetadata.ContainsKey(RedisRateLimitLease.RetryAfterMetadataName));
    }

    [Fact]
    public void AcquiredLease_HasNoRetryAfterMetadata()
    {
        var lease = new RedisRateLimitLease(isAcquired: true);

        Assert.True(lease.IsAcquired);
        Assert.Empty(lease.MetadataNames);

        var hasMetadata = lease.TryGetMetadata(RedisRateLimitLease.RetryAfterMetadataName, out var metadata);

        Assert.False(hasMetadata);
        Assert.Null(metadata);
        Assert.Empty(lease.GetAllMetadata());
    }
}
