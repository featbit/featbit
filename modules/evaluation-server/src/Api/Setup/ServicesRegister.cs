using Confluent.Kafka;
using Infrastructure.Fakes;
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

        // add bounded memory cache
        services.AddSingleton<BoundedMemoryCache>();

        // build streaming service
        var streamingBuilder = services.AddStreamingCore();
        if (configuration.GetValue("IntegrationTests", false))
        {
            streamingBuilder.UseStore<FakeStore>().UseNullMessageQueue();
        }
        else
        {
            streamingBuilder.UseHybridStore(configuration);

            var isProVersion = configuration["IS_PRO"];
            if (isProVersion.Equals(bool.TrueString, StringComparison.OrdinalIgnoreCase))
            {
                var producerConfigDictionary = new Dictionary<string, string>();
                configuration.GetSection("Kafka:Producer").Bind(producerConfigDictionary);
                var producerConfig = new ProducerConfig(producerConfigDictionary);
                services.AddSingleton(producerConfig);

                var consumerConfigDictionary = new Dictionary<string, string>();
                configuration.GetSection("Kafka:Consumer").Bind(consumerConfigDictionary);
                var consumerConfig = new ConsumerConfig(consumerConfigDictionary);
                services.AddSingleton(consumerConfig);

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