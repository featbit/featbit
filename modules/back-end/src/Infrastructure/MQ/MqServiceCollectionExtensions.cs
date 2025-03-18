using Confluent.Kafka;
using Domain.Messages;
using Infrastructure.MQ.Kafka;
using Infrastructure.MQ.Postgres;
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
            case MqProvider.Postgres:
                AddPostgresMq();
                break;
        }

        return;

        void AddRedisMq()
        {
            services.AddSingleton<IMessageProducer, RedisMessageProducer>();
            services.AddHostedService<RedisMessageConsumer>();

            services.AddKeyedTransient<IMessageHandler, EndUserMessageHandler>(Topics.EndUser);
            services.AddKeyedTransient<IMessageHandler, InsightMessageHandler>(Topics.Insights);
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

        void AddPostgresMq()
        {
            services.AddSingleton<IMessageProducer, PostgresMessageProducer>();
            services.AddHostedService<PostgresMessageConsumer>();

            services.AddKeyedTransient<IMessageHandler, EndUserMessageHandler>(Topics.EndUser);
            services.AddKeyedTransient<IMessageHandler, InsightMessageHandler>(Topics.Insights);
        }
    }
}