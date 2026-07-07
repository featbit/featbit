using Application.Caches;

namespace Infrastructure.Caches.None;

public class NonePopulatingService : ICachePopulatingService
{
    public Task PopulateAsync(CancellationToken stoppingToken) => Task.CompletedTask;
}