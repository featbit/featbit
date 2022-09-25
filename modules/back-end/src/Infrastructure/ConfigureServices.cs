using System.Text;
using Application.Services;
using Domain.Identity;
using Domain.Users;
using Infrastructure.Identity;
using Infrastructure.Members;
using Infrastructure.MongoDb;
using Infrastructure.Organizations;
using Infrastructure.Users;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.IdentityModel.Tokens;
using MongoDB.Bson.Serialization.Conventions;

// ReSharper disable CheckNamespace
namespace Microsoft.Extensions.DependencyInjection;
// ReSharper restore CheckNamespace

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
        services.AddScoped<IIdentityService, IdentityService>();

        // authentication
        var jwtOption = configuration.GetSection(JwtOptions.Jwt);
        services.Configure<JwtOptions>(jwtOption);
        services
            .AddAuthentication()
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = jwtOption["Issuer"],

                    ValidateAudience = true,
                    ValidAudience = jwtOption["Audience"],

                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOption["Key"]))
                };
            });
        
        // custom services
        services.AddScoped<IUserService, UserService>();
        services.AddTransient<IOrganizationService, OrganizationService>();
        services.AddTransient<IMemberService, MemberService>();

        return services;
    }
}