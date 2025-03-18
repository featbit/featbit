using Infrastructure.Fakes;
using Infrastructure;
using Infrastructure.MQ;
using Serilog;
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
        services.AddSingleton<BoundedMemoryCache>();

        // build streaming service
        var streamingBuilder = services.AddStreamingCore();
        if (configuration.GetValue("IntegrationTests", false))
        {
            var config = new ConfigurationBuilder()
                .AddInMemoryCollection([
                    new KeyValuePair<string, string?>(MqProvider.SectionName, MqProvider.None)
                ])
                .Build();

            streamingBuilder.UseStore<FakeStore>().UseMq(config);
        }
        else
        {
            streamingBuilder
                .UseHybridStore(configuration)
                .UseMq(configuration);
        }

        return builder;
    }
}