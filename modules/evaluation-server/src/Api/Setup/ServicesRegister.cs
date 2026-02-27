using Api.Services;
using Domain.Workspaces;
using Infrastructure;
using Infrastructure.Services;
using Serilog;
using Streaming;
using Streaming.DependencyInjection;

namespace Api.Setup;

public static class ServicesRegister
{
    public static WebApplicationBuilder RegisterServices(this WebApplicationBuilder builder)
    {
        var services = builder.Services;
        var configuration = builder.Configuration;

        services.AddControllers();

        // serilog
        builder.Services.AddSerilog((_, lc) => ConfigureSerilog.Configure(lc, builder.Configuration));

        // Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen();

        // health check dependencies
        services.AddHealthChecks().AddReadinessChecks(configuration);

        // cors
        builder.Services.AddCors(options => options.AddDefaultPolicy(policyBuilder =>
        {
            policyBuilder
                .AllowAnyOrigin()
                .AllowAnyHeader()
                .AllowAnyMethod();
        }));

        // add bounded memory cache
        services.AddSingleton<IBoundedMemoryCache, BoundedMemoryCache>();

        // streaming services
        services
            .AddStreamingCore(options => configuration.GetSection(StreamingOptions.Streaming).Bind(options))
            .UseStore(configuration)
            .UseMq(configuration);

        // application services
        LicenseVerifier.ImportPublicKey(configuration["PublicKey"]);
        services.AddTransient<IRelayProxyAppService, RelayProxyAppService>();
        services.AddTransient<IFeatureFlagService, FeatureFlagService>();

        return builder;
    }
}