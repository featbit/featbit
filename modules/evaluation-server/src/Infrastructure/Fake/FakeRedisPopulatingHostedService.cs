using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using StackExchange.Redis;

namespace Infrastructure.Caches;

public class FakeRedisPopulatingHostedService : IHostedService
{
    public FakeRedisPopulatingHostedService()
    {
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}