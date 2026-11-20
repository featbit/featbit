using Application.Bases.Behaviours;
using MediatR;

namespace Api.Setup;

public static class MediationRegister
{
    /// <summary>
    /// Registers the mediator for the control plane's own requests (<c>Api.Application</c>), with request
    /// validation in the pipeline.
    /// </summary>
    public static IServiceCollection AddMediation(this IServiceCollection services)
    {
        services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(MediationRegister).Assembly));
        services.AddTransient(typeof(IPipelineBehavior<,>), typeof(ValidationBehaviour<,>));

        return services;
    }
}
