using Infrastructure.MongoDb;
using Infrastructure.Redis;

namespace Streaming;

public class StreamingOptions
{
    public RedisOptions Redis { get; set; } = null!;

    public MongoDbOptions MongoDb { get; set; } = null!;
}