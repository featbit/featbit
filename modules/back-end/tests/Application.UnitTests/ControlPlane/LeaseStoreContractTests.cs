using Application.ControlPlane;
using Domain.ControlPlane;

namespace Application.UnitTests.ControlPlane;

public class LeaseStoreContractTests
{
    private static readonly Guid EnvId = Guid.Parse("00000000-0000-0000-0000-000000000001");

    [Fact]
    public void DcLease_ExposesExpectedShape()
    {
        var now = DateTimeOffset.UtcNow;

        var lease = new DcLease
        {
            DcId = "dc-west",
            Region = "us-west",
            LastHeartbeatAt = now,
            LeaseExpiresAt = now.AddMinutes(1),
            AppliedWatermarks = new Dictionary<Guid, long> { [EnvId] = 42 }
        };

        Assert.Equal("dc-west", lease.DcId);
        Assert.Equal("us-west", lease.Region);
        Assert.Equal(now, lease.LastHeartbeatAt);
        Assert.Equal(now.AddMinutes(1), lease.LeaseExpiresAt);
        Assert.Equal(42, lease.AppliedWatermarks[EnvId]);
    }

    [Fact]
    public void AppliedWatermarks_DefaultsToEmptyDictionary()
    {
        var lease = new DcLease();

        Assert.NotNull(lease.AppliedWatermarks);
        Assert.Empty(lease.AppliedWatermarks);
    }

    [Fact]
    public async Task ILeaseStore_ContractIsCallable()
    {
        var now = DateTimeOffset.UtcNow;
        var live = new DcLease { DcId = "dc-east", LeaseExpiresAt = now.AddMinutes(5) };

        var store = new Mock<ILeaseStore>();
        store
            .Setup(x => x.GetLiveSetAsync(It.IsAny<DateTimeOffset>()))
            .ReturnsAsync(new[] { live });

        await store.Object.UpsertLeaseAsync(live);
        await store.Object.UpdateAppliedWatermarkAsync("dc-east", EnvId, 7);
        IReadOnlyList<DcLease> liveSet = await store.Object.GetLiveSetAsync(now);

        Assert.Single(liveSet);
        Assert.Equal("dc-east", liveSet[0].DcId);
        store.Verify(x => x.UpsertLeaseAsync(live), Times.Once);
        store.Verify(x => x.UpdateAppliedWatermarkAsync("dc-east", EnvId, 7), Times.Once);
    }
}
