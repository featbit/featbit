using Application.Services;
using Domain.Users;
using Infrastructure.Identity;
using Infrastructure.MongoDb;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection.Extensions;
using MongoDB.Bson.Serialization.Conventions;
using IdentityOptions = Domain.Identity.IdentityOptions;

// ReSharper disable once CheckNamespace
namespace Microsoft.Extensions.DependencyInjection;

public static class ConfigureServices
{
    public static IServiceCollection AddInfrastructureServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // mongodb
        var conventions = new ConventionPack
        {
            new IgnoreExtraElementsConvention(true),
            new CamelCaseElementNameConvention()
        };
        ConventionRegistry.Register("global-conventions", conventions, _ => true);
        
        services.Configure<MongoDbOptions>(configuration.GetSection(MongoDbOptions.MongoDb));
        services.AddSingleton<MongoDbClient>();

        // identity
        services.TryAddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
        services.AddScoped<IUserStore, MongoDbUserStore>();
        services.Configure<IdentityOptions>(configuration.GetSection(IdentityOptions.Identity));
        services.AddTransient<IIdentityService, IdentityService>();

        return services;
    }
}