using Domain.Utils;

namespace Domain.UnitTests.Utils;

public class DateTimeExtensionsTests
{
    [Fact]
    public void ToUnixTimeMilliseconds_KnownInstant_ReturnsSameValueAsDateTimeOffset()
    {
        var dt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        var actual = dt.ToUnixTimeMilliseconds();

        Assert.Equal(new DateTimeOffset(dt).ToUnixTimeMilliseconds(), actual);
        Assert.Equal(1_704_067_200_000L, actual);
    }

    [Fact]
    public void ToUnixTimeMilliseconds_UnixEpoch_ReturnsZero()
    {
        var epoch = new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        Assert.Equal(0L, epoch.ToUnixTimeMilliseconds());
    }
}
