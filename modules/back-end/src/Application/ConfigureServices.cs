using System.Reflection;
using Application.Bases.Behaviours;
using Application.Users;
using Application.Webhooks;

// ReSharper disable CheckNamespace
namespace Microsoft.Extensions.DependencyInjection;
// ReSharper restore CheckNamespace

public static class ConfigureServices
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        // automapper
        services.AddAutoMapper(Assembly.GetExecutingAssembly());

        // fluent validation
        ValidatorOptions.Global.DefaultRuleLevelCascadeMode = CascadeMode.Stop;
        services.AddValidatorsFromAssembly(Assembly.GetExecutingAssembly());

        // MediatR
        services.AddMediatR(Assembly.GetExecutingAssembly());
        services.AddTransient(typeof(IPipelineBehavior<,>), typeof(ValidationBehaviour<,>));

        // custom services
        services.AddHttpContextAccessor();
        services.AddSingleton<ICurrentUser, CurrentUser>();
        services.AddTransient<IWebhookHandler, WebhookHandler>();

        // add httpclient services
        services.AddHttpClient();

        return services;
    }
}