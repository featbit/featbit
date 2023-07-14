using Infrastructure.Fakes;
using Infrastructure.Redis;
using Streaming.DependencyInjection;

namespace Api.Setup;

public static class ServicesRegister
{
    public static WebApplicationBuilder RegisterServices(this WebApplicationBuilder builder)
    {
        var services = builder.Services;
        var configuration = builder.Configuration;

        services.AddControllers();

        // Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
        services.AddEndpointsApiExplorer();
        services.AddSwaggerGen();

        // health check dependencies
        services.AddHealthChecks();

        // cors
        builder.Services.AddCors(options => options.AddDefaultPolicy(policyBuilder =>
        {
            policyBuilder
                .AllowAnyOrigin()
                .AllowAnyHeader()
                .AllowAnyMethod();
        }));

        // build streaming service
        var streamingBuilder = services.AddStreamingCore();
        if (builder.Environment.IsEnvironment("IntegrationTests"))
        {
            streamingBuilder.UseStore<FakeStore>().UseNullMessageQueue();
        }
        else
        {
            streamingBuilder.UseRedisStore(options => configuration.GetSection(RedisOptions.Redis).Bind(options));

            var isProVersion = configuration["IS_PRO"];
            if (isProVersion.Equals(bool.TrueString, StringComparison.OrdinalIgnoreCase))
            {
                // use kafka as message queue in pro version
                streamingBuilder.UseKafkaMessageQueue();
            }
            else
            {
                // use redis as message queue in standard version
                streamingBuilder.UseRedisMessageQueue();
            }
        }

        return builder;
    }
}