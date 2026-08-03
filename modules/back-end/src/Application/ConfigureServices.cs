using System.Reflection;
using Application;
using Application.Bases.Behaviours;
using Application.FeatureFlags;
using Application.Policies;
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
        // automapper
        services.AddAutoMapper(Assembly.GetExecutingAssembly());

        // fluent validation
        ValidatorOptions.Global.DefaultRuleLevelCascadeMode = CascadeMode.Stop;
        services.AddValidatorsFromAssembly(Assembly.GetExecutingAssembly());

        // MediatR
        services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(Assembly.GetExecutingAssembly()));
        services.AddTransient(typeof(IPipelineBehavior<,>), typeof(ValidationBehaviour<,>));

        // custom services
        services.AddHttpContextAccessor();
        services.AddSingleton<ICurrentUser, CurrentUser>();
        services.AddTransient<IPermissionGuard, PermissionGuard>();
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