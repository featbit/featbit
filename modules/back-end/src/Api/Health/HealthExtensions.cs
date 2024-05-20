namespace Api.Health
{
    public static class HealthExtensions
    {
        private static readonly string _producerConfigSection = "Kafka:Producer";
        private static readonly string _consumerConfigSection = "Kafka:Consumer";
        private static readonly string _serverConfigSection = "bootstrap.servers";

        public static IHealthChecksBuilder AddFeatBitHealthChecks(this IHealthChecksBuilder builder, IConfiguration configuration)
        {            
            builder.AddCheck<MongoDbHealthCheck>("Check If MongoDB Is Available")
                .AddCheck<RedisHealthCheck>("Check If Redis Is Available");
            
            if (configuration.IsFeatBitPro())
            {
                builder.AddCheck<KafkaHealthCheck>("Check If Kafka Is Available");
            }

            return builder;
        }

        public static bool IsFeatBitPro(this IConfiguration configuration)
            => configuration["IS_PRO"].Equals(bool.TrueString, StringComparison.OrdinalIgnoreCase);

        public static IEnumerable<string> GetKafkaHosts(this IConfiguration configuration)
        {
            var resultSet = new HashSet<string>();

            var producerConfigDictionary = new Dictionary<string, string>();
            configuration.GetSection(_producerConfigSection).Bind(producerConfigDictionary);
            var producerHost = producerConfigDictionary[_serverConfigSection];

            if (producerHost != null) 
            {
                resultSet.Add(producerHost);
            }

            var consumerConfigDictionary = new Dictionary<string, string>();
            configuration.GetSection(_consumerConfigSection).Bind(consumerConfigDictionary);
            var consumerHost = consumerConfigDictionary[_serverConfigSection];

            if (consumerHost != null)
            {
                resultSet.Add(consumerHost);
            }

            return resultSet;
        }
    }
}
