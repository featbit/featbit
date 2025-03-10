using Confluent.Kafka;
using Domain.Messages;
using Infrastructure.MQ.Kafka;
using Infrastructure.MQ.Redis;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Infrastructure.MQ;

public static class MqServiceCollectionExtensions
{
    public static void AddMq(this IServiceCollection services, IConfiguration configuration)
    {
        var mqProvider = configuration.GetMqProvider();

        switch (mqProvider)
        {
            case MqProvider.Redis:
                AddRedisMq();
                break;
            case MqProvider.Kafka:
                AddKafkaMq();
                break;
        }

        return;

        void AddRedisMq()
        {
            services.AddSingleton<IMessageProducer, RedisMessageProducer>();

            services.AddKeyedTransient<IMessageHandler, EndUserMessageHandler>(nameof(EndUserMessageHandler));
            services.AddKeyedTransient<IMessageHandler, InsightMessageHandler>(nameof(InsightMessageHandler));
            services.AddHostedService<RedisMessageConsumer>();
        }

        void AddKafkaMq()
        {
            var producerConfigDictionary = new Dictionary<string, string>();
            configuration.GetSection("Kafka:Producer").Bind(producerConfigDictionary);
            var producerConfig = new ProducerConfig(producerConfigDictionary);
            services.AddSingleton(producerConfig);

            var consumerConfigDictionary = new Dictionary<string, string>();
            configuration.GetSection("Kafka:Consumer").Bind(consumerConfigDictionary);
            var consumerConfig = new ConsumerConfig(consumerConfigDictionary);
            services.AddSingleton(consumerConfig);

            services.AddSingleton<IMessageProducer, KafkaMessageProducer>();
            services.AddHostedService<KafkaMessageConsumer>();
        }
    }
}