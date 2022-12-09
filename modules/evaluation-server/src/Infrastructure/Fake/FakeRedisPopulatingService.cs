using StackExchange.Redis;
using Microsoft.Extensions.Logging;
using Infrastructure.MongoDb;

namespace Infrastructure.Caches;

public class FakeRedisPopulatingService : IPopulatingService
{

    public FakeRedisPopulatingService()
    {
    }

    public async Task<bool> PopulateAsync()
    {
        var populateFlags = await PopulateFlagsAsync();
        var populateSegments = await PopulateSegmentAsync();

        return populateFlags && populateSegments;
    }

    public async Task<bool> PopulateFlagsAsync()
    {
        return true;
    }

    private async Task<bool> PopulateSegmentAsync()
    {
        return true;
    }
}