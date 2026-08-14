using Infrastructure.OLAP.ClickHouse;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using ClickHouseServices = Infrastructure.Services.ClickHouse;

namespace Infrastructure.OLAP;

public static class OLAPServiceCollectionExtensions
{
    public static void AddOLAPSpecificServices(
        this IServiceCollection services,
        IConfiguration configuration,
        string fallbackProvider)
    {
        var provider = configuration.GetValue(OLAPProvider.SectionName, fallbackProvider);
        if (provider != OLAPProvider.ClickHouse)
        {
            return;
        }

        services.AddOptionsWithValidateOnStart<ClickHouseOptions>()
            .Bind(configuration.GetSection(ClickHouseOptions.ClickHouse))
            .ValidateDataAnnotations();

        services.AddHttpClient<ClickHouseClient>();

        services.AddTransient<IFeatureFlagInsightsService, ClickHouseServices.ExperimentFeatureFlagInsightsService>();
        services.AddTransient<IFeatureFlagEndUserStatsService, ClickHouseServices.ExperimentFeatureFlagEndUserStatsService>();
        services.AddTransient<IExperimentStatsService, ClickHouseServices.ExperimentStatsService>();
    }
}
