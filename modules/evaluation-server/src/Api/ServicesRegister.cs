using Infrastructure;
using Infrastructure.Redis;
using Streaming;

namespace Api;

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

        // add streaming core
        services.AddStreamingCore();

        // add store and message queue
        if (builder.Environment.IsEnvironment("IntegrationTests"))
        {
            // for integration tests, use faked services
            services
                .AddFakeStore()
                .AddFakeMessageQueue();
        }
        else
        {
            // redis store
            var redisOptions = configuration.GetValue<RedisOptions>(RedisOptions.Redis);
            services.AddRedisStore(redisOptions);

            // message queue
            var isProVersion = configuration["IS_PRO"];
            if (isProVersion.Equals(bool.TrueString, StringComparison.OrdinalIgnoreCase))
            {
                // use kafka as message queue in pro version
                services.AddKafkaMessageQueue();
            }
            else
            {
                // use redis as message queue
                services.AddRedisMessageQueue();
            }
        }

        return builder;
    }
}