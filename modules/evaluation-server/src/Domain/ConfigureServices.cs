using Domain.Evaluation;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Domain;

public static class ConfigureServices
{
    public static IServiceCollection AddEvaluator(this IServiceCollection services)
    {
        services.TryAddSingleton<IEvaluator, Evaluator>();
        services.TryAddSingleton<IRuleMatcher, RuleMatcher>();

        return services;
    }
}