using System.Text;
using Domain.Identity;
using Domain.Users;
using Infrastructure.Caches;
using Infrastructure.HostedServices;
using Infrastructure.DataSync;
using Infrastructure.EndUsers;
using Infrastructure.Environments;
using Infrastructure.FeatureFlags;
using Infrastructure.Groups;
using Infrastructure.Identity;
using Infrastructure.Members;
using Infrastructure.Organizations;
using Infrastructure.Policies;
using Infrastructure.Projects;
using Infrastructure.Resources;
using Infrastructure.Segments;
using Infrastructure.Triggers;
using Infrastructure.Users;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using StackExchange.Redis;

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
        services.Configure<MongoDbOptions>(configuration.GetSection(MongoDbOptions.MongoDb));
        services.AddSingleton<MongoDbClient>();

        // redis
        var multiplexer = ConnectionMultiplexer.Connect(configuration["Redis:ConnectionString"]);
        services.AddSingleton<IConnectionMultiplexer>(multiplexer);

        // identity
        services.AddScoped<IPasswordHasher<User>, PasswordHasher<User>>();
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

        // hosted services
        services.AddHostedService<KafkaConsumerService>();
        services.AddHostedService<RedisPopulatingHostedService>();

        // custom services
        services.AddScoped<IUserService, UserService>();
        services.AddTransient<IOrganizationService, OrganizationService>();
        services.AddTransient<IMemberService, MemberService>();
        services.AddTransient<IProjectService, ProjectService>();
        services.AddTransient<IGroupService, GroupService>();
        services.AddTransient<IPolicyService, PolicyService>();
        services.AddTransient<IEnvironmentService, EnvironmentService>();
        services.AddTransient<IResourceService, ResourceService>();
        services.AddTransient<IEndUserService, EndUserService>();
        services.AddTransient<ISegmentService, SegmentService>();
        services.AddTransient<IFeatureFlagService, FeatureFlagService>();
        services.AddTransient<ITriggerService, TriggerService>();
        services.AddTransient<IDataSyncService, DataSyncService>();
        services.AddTransient<IPopulatingService, RedisPopulatingService>();

        return services;
    }
}