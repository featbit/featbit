using Microsoft.Extensions.DependencyInjection;

namespace Streaming.DependencyInjection;

public class StreamingBuilder : IStreamingBuilder
{
    public IServiceCollection Services { get; }

    /// <summary>
    /// Initializes a new <see cref="StreamingBuilder"/> instance.
    /// </summary>
    /// <param name="services">The <see cref="IServiceCollection" /> to add services to.</param>
    public StreamingBuilder(IServiceCollection services)
    {
        Services = services ?? throw new ArgumentNullException(nameof(services));
    }
}