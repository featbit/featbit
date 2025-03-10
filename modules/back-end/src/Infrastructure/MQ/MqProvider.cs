namespace Infrastructure.MQ;

public static class MqProvider
{
    public const string Redis = nameof(Redis);

    public const string Kafka = nameof(Kafka);

    public const string Postgres = nameof(Postgres);
}