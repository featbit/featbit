using Application.Caches;
using Infrastructure.Caches.None;
using Infrastructure.Caches.Redis;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Infrastructure.Caches;

public static class CacheServiceCollectionExtensions
{
    public static void AddCache(this IServiceCollection services, IConfiguration configuration)
    {
        var cacheProvider = configuration.GetCacheProvider();

        switch (cacheProvider)
        {
            case CacheProvider.None:
                AddNone();
                break;
            case CacheProvider.Redis:
                AddRedis();
                break;
        }

        // populate cache
        services.AddHostedService<CachePopulatingHostedService>();

        return;

        void AddNone()
        {
            services.AddTransient<ICachePopulatingService, NonePopulatingService>();
            services.AddTransient<ICacheService, NoneCacheService>();
        }

        void AddRedis()
        {
            services.TryAddRedis(configuration);

            services.AddTransient<ICachePopulatingService, RedisPopulatingService>();
            services.AddTransient<ICacheService, RedisCacheService>();
        }
    }
}