using System.Reflection;
using Application;
using Application.AuditLogs;
using Application.Bases.Behaviours;
using Application.Environments;
using Application.FeatureFlags;
using Application.Segments;
using Application.Users;
using Microsoft.Extensions.Configuration;

// ReSharper disable CheckNamespace
namespace Microsoft.Extensions.DependencyInjection;
// ReSharper restore CheckNamespace

public static class ConfigureServices
{
    public static IServiceCollection AddApplicationServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // fluent validation
        ValidatorOptions.Global.DefaultRuleLevelCascadeMode = CascadeMode.Stop;
        services.AddValidatorsFromAssembly(Assembly.GetExecutingAssembly());

        // custom services
        services.AddHttpContextAccessor();
        services.AddSingleton<ICurrentUser, CurrentUser>();
        services.AddTransient<FlagPermissionGuard>();
        services.AddTransient<EnvironmentPermissionGuard>();
        services.AddTransient<SegmentPermissionGuard>();
        services.AddTransient<SegmentCreationScopeGuard>();
        services.AddTransient<FlagCopyChecks>();
        services.AddTransient<AuditLogAccessGuard>();
        services.AddTransient<ISegmentMessageService, SegmentMessageService>();
        if (configuration.UseControlPlane())
        {
            services.AddScoped<ISegmentChangePublisher, ControlPlaneSegmentChangePublisher>();
            services.AddScoped<IFeatureFlagChangePublisher, ControlPlaneFeatureFlagChangePublisher>();
        }
        else
        {
            services.AddScoped<ISegmentChangePublisher, DirectSegmentChangePublisher>();
            services.AddScoped<IFeatureFlagChangePublisher, DirectFeatureFlagChangePublisher>();
        }

        // add httpclient services
        services.AddHttpClient();

        return services;
    }
}
