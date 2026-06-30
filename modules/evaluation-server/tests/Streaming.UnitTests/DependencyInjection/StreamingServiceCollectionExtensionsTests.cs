using Microsoft.Extensions.DependencyInjection;
using Streaming.Connections;
using Streaming.Consumers;
using Streaming.DependencyInjection;
using Streaming.Messages;
using Streaming.Services;
using Domain.Messages;
using Microsoft.Extensions.Internal;

namespace Streaming.UnitTests.DependencyInjection;

public class StreamingServiceCollectionExtensionsTests
{
    [Fact]
    public void AddStreamingCore_DefaultOptions_RegistersAllCoreServices()
    {
        var services = new ServiceCollection();

        var builder = services.AddStreamingCore();

        Assert.NotNull(builder);
        Assert.Same(services, builder.Services);

        // Inspect registrations directly (don't build a provider — some services depend on
        // IStore/IEvaluator which are added by separate UseStore/AddEvaluator calls).
        Assert.Contains(services, d => d.ServiceType == typeof(StreamingOptions));
        AssertRegistered<ISystemClock, SystemClock>(services);
        AssertRegistered<IRequestValidator, RequestValidator>(services);
        AssertRegistered<IConnectionManager, ConnectionManager>(services);
        AssertRegistered<IDataSyncService, DataSyncService>(services);
        Assert.Contains(services, d =>
            d.ServiceType == typeof(IRelayProxyService) && d.ImplementationType == typeof(RelayProxyService));
        Assert.Contains(services, d => d.ServiceType == typeof(MessageDispatcher));

        var handlerTypes = services
            .Where(d => d.ServiceType == typeof(IMessageHandler))
            .Select(d => d.ImplementationType)
            .ToList();
        Assert.Equal(4, handlerTypes.Count);
        Assert.Contains(typeof(PingMessageHandler), handlerTypes);
        Assert.Contains(typeof(EchoMessageHandler), handlerTypes);
        Assert.Contains(typeof(DataSyncMessageHandler), handlerTypes);
        Assert.Contains(typeof(RpAgentStatusMessageHandler), handlerTypes);

        var consumerTypes = services
            .Where(d => d.ServiceType == typeof(IMessageConsumer))
            .Select(d => d.ImplementationType)
            .ToList();
        Assert.Equal(2, consumerTypes.Count);
        Assert.Contains(typeof(FeatureFlagChangeMessageConsumer), consumerTypes);
        Assert.Contains(typeof(SegmentChangeMessageConsumer), consumerTypes);
    }

    private static void AssertRegistered<TService, TImpl>(IServiceCollection services) =>
        Assert.Contains(services,
            d => d.ServiceType == typeof(TService) && d.ImplementationType == typeof(TImpl));

    [Fact]
    public void AddStreamingCore_ConfigureOptions_InvokesConfigureAndUsesOptions()
    {
        var invocations = 0;
        var services = new ServiceCollection();

        services.AddStreamingCore(_ => invocations++);

        var resolved = services.BuildServiceProvider().GetRequiredService<StreamingOptions>();

        Assert.Equal(1, invocations);
        Assert.NotNull(resolved);
    }

    [Fact]
    public void AddStreamingCore_CustomRpService_RegistersCustomTypeInsteadOfDefault()
    {
        var services = new ServiceCollection();
        services.AddStreamingCore(options => options.CustomRpService = new FakeRelayProxyService());

        var rpDescriptor = Assert.Single(services, d => d.ServiceType == typeof(IRelayProxyService));
        Assert.Equal(typeof(FakeRelayProxyService), rpDescriptor.ImplementationType);
    }

    private sealed class FakeRelayProxyService : IRelayProxyService
    {
        public Task<Domain.Shared.SecretWithValue[]> GetSecretsAsync(string key) =>
            Task.FromResult(Array.Empty<Domain.Shared.SecretWithValue>());

        public Task<Domain.Shared.Secret[]> GetServerSecretsAsync(string key) =>
            Task.FromResult(Array.Empty<Domain.Shared.Secret>());

        public Task UpdateAgentStatusAsync(string key, string agentId, string status) => Task.CompletedTask;
    }
}
