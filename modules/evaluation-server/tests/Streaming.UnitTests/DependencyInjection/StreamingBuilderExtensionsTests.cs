using Domain.Messages;
using Domain.Shared;
using Infrastructure;
using Infrastructure.Caches;
using Infrastructure.Fakes;
using Infrastructure.MQ;
using Infrastructure.Persistence;
using Infrastructure.Store;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Streaming.DependencyInjection;

namespace Streaming.UnitTests.DependencyInjection;

public class StreamingBuilderExtensionsTests
{
    private static IConfiguration BuildConfiguration(Dictionary<string, string?> values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values).Build();

    private static IStreamingBuilder NewBuilder() => new StreamingBuilder(new ServiceCollection());

    [Fact]
    public void UseMq_MqProviderNone_RegistersNoneMessageProducerAndNoHostedService()
    {
        var builder = NewBuilder();
        var config = BuildConfiguration(new() { ["MqProvider"] = MqProvider.None });

        builder.UseMq(config);

        var provider = builder.Services.BuildServiceProvider();
        var producer = provider.GetRequiredService<IMessageProducer>();

        Assert.IsType<NoneMessageProducer>(producer);
        Assert.Empty(provider.GetServices<IHostedService>());
    }

    [Fact]
    public void UseMq_ReturnsSameBuilderForChaining()
    {
        var builder = NewBuilder();
        var config = BuildConfiguration(new() { ["MqProvider"] = MqProvider.None });

        var result = builder.UseMq(config);

        Assert.Same(builder, result);
    }

    [Fact]
    public void UseStore_FakeProviderWithoutCache_RegistersFakeStoreAsIStore()
    {
        var builder = NewBuilder();
        var config = BuildConfiguration(new()
        {
            ["DbProvider"] = DbProvider.Fake,
            ["CacheProvider"] = CacheProvider.None
        });

        builder.UseStore(config);

        var provider = builder.Services.BuildServiceProvider();

        Assert.IsType<FakeStore>(provider.GetRequiredService<IDbStore>());
        Assert.IsType<FakeStore>(provider.GetRequiredService<IStore>());
    }

    [Fact]
    public void UseStore_ReturnsSameBuilderForChaining()
    {
        var builder = NewBuilder();
        var config = BuildConfiguration(new()
        {
            ["DbProvider"] = DbProvider.Fake,
            ["CacheProvider"] = CacheProvider.None
        });

        var result = builder.UseStore(config);

        Assert.Same(builder, result);
    }
}
