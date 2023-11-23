namespace Infrastructure.Redis;

public class RedisOptions
{
    public const string Redis = nameof(Redis);

    public string ConnectionString { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;
}