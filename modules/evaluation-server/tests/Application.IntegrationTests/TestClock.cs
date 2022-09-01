using Microsoft.Extensions.Internal;

namespace Application.IntegrationTests;

public class TestClock : ISystemClock
{
    public DateTimeOffset UtcNow { get; }

    public TestClock(long timestamp = 0)
    {
        UtcNow = timestamp == 0
            ? DateTimeOffset.UtcNow
            : DateTimeOffset.FromUnixTimeMilliseconds(timestamp);
    }
}