using Infrastructure.AppService;
using Infrastructure.Caches;
using Infrastructure.MQ;
using Infrastructure.OLAP;
using Infrastructure.Persistence;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Infrastructure.UnitTests;

public class ConfigureServicesTests
{
    [Theory]
    [InlineData(OLAPProvider.MongoDb, MqProvider.None, true)]
    [InlineData(OLAPProvider.ClickHouse, MqProvider.Kafka, false)]
    public void RegistersInsightsWriterOnlyWhenApplicationConsumesInsights(
        string olapProvider,
        string mqProvider,
        bool expected)
    {
        var configuration = new ConfigurationManager
        {
            [CacheProvider.SectionName] = CacheProvider.None,
            [MqProvider.SectionName] = mqProvider,
            [DbProvider.SectionName] = DbProvider.MongoDb,
            [OLAPProvider.SectionName] = olapProvider,
            ["MongoDb:ConnectionString"] = "mongodb://localhost/featbit",
            ["ClickHouse:ConnectionString"] = "http://localhost:8123"
        };
        var services = new ServiceCollection();

        services.AddInfrastructureServices(configuration);

        Assert.Equal(expected, services.Any(x => x.ServiceType == typeof(InsightsWriter)));
    }
}
