using Infrastructure.Redis;
using Moq;
using StackExchange.Redis;

namespace Application.IntegrationTests.Stubs;

public class TestRedisClient : IRedisClient
{
    public IDatabase GetDatabase()
    {
        var mockedDb = new Mock<IDatabase>();

        return mockedDb.Object;
    }

    public Task<TimeSpan> PingAsync() => Task.FromResult(TimeSpan.Zero);
}