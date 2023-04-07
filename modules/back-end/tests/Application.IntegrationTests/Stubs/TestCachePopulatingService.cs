using Application.Caches;

namespace Application.IntegrationTests.Stubs;

public class TestCachePopulatingService : ICachePopulatingService
{
    public Task PopulateAsync()
    {
        return Task.CompletedTask;
    }
}