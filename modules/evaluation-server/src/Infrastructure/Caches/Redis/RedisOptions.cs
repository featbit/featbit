using System.ComponentModel.DataAnnotations;

namespace Infrastructure.Caches.Redis;

public class RedisOptions
{
    public const string Redis = nameof(Redis);

    [Required(ErrorMessage = "Redis connection string must be set.")]
    public string ConnectionString { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;
}