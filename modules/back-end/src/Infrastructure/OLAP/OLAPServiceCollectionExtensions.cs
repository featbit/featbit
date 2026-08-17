using Infrastructure.OLAP.ClickHouse;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using ClickHouseServices = Infrastructure.Services.ClickHouse;

namespace Infrastructure.OLAP;

public static class OLAPServiceCollectionExtensions
{
    public static void AddClickHouseServices(this IServiceCollection services, IConfiguration configuration)
    {
    }
}
