using Microsoft.Extensions.DependencyInjection;

namespace Streaming.DependencyInjection;

/// <summary>
/// An interface for configuring Streaming services.
/// </summary>
public interface IStreamingBuilder
{
    /// <summary>
    /// Gets the <see cref="IServiceCollection"/> where Streaming services are configured.
    /// </summary>
    IServiceCollection Services { get; }
}