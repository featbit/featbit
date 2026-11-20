using Application.Bases.Behaviours;

namespace Api.Setup;

public static class MediationRegister
{
    /// <summary>
    /// Registers the mediator for the control plane's own requests (<c>Api.Application</c>), with request
    /// validation in the pipeline.
    /// </summary>
    public static IServiceCollection AddMediation(this IServiceCollection services)
    {
        services.AddMediator(options =>
        {
            options.Assemblies = [typeof(MediationRegister)];
            options.ServiceLifetime = ServiceLifetime.Transient;
            options.NotificationPublisherType = typeof(SequentialNotificationPublisher);
            options.PipelineBehaviors = [typeof(ValidationBehaviour<,>)];
        });

        return services;
    }
}
