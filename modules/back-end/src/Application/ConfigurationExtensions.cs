using Microsoft.Extensions.Configuration;

namespace Application;

public static class ConfigurationExtensions
{
    public static bool IsSaasHosting(this IConfiguration configuration)
    {
        var mode = configuration.GetSection(HostingMode.SectionName).Value ?? HostingMode.SelfHosted;

        return mode == HostingMode.SaaS;
    }
}