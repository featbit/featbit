using Api.Application.Admin;
using Api.Setup;
using Application.Bases.Behaviours;
using Domain.Messages;
using Infrastructure.Caches.Redis;
using Mediator;
using Microsoft.Extensions.DependencyInjection;
using Moq;

namespace Api.UnitTests.Setup;

/// <summary>
/// The control plane's mediator as <see cref="MediationRegister.AddMediation"/> registers it.
/// </summary>
public class MediationRegisterTests
{
    private readonly Mock<IMessageProducer> _producer = new();

    private ServiceProvider BuildServices()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton(_producer.Object);
        services.AddSingleton(Mock.Of<IRedisClient>());
        services.AddMediation();

        return services.BuildServiceProvider(new ServiceProviderOptions { ValidateScopes = true, ValidateOnBuild = true });
    }

    [Fact]
    public async Task Send_PushFullSync_RunsItsHandler()
    {
        using var provider = BuildServices();
        using var scope = provider.CreateScope();
        var sender = scope.ServiceProvider.GetRequiredService<ISender>();

        var result = await sender.Send(new PushFullSync(), CancellationToken.None);

        Assert.True(result);
        _producer.Verify(x => x.PublishAsync(ControlPlaneTopics.ControlPlaneCommand, It.IsAny<object>()), Times.Once);
    }

    [Fact]
    public void Services_SenderAndHandlers_AreTransient()
    {
        using var provider = BuildServices();
        using var scope = provider.CreateScope();
        var services = scope.ServiceProvider;

        Assert.NotSame(services.GetRequiredService<ISender>(), services.GetRequiredService<ISender>());
        Assert.NotSame(
            services.GetRequiredService<IRequestHandler<PushFullSync, bool>>(),
            services.GetRequiredService<IRequestHandler<PushFullSync, bool>>());
    }

    [Fact]
    public void Services_Pipeline_IncludesValidation()
    {
        using var provider = BuildServices();
        using var scope = provider.CreateScope();

        Assert.Contains(
            scope.ServiceProvider.GetServices<IPipelineBehavior<PushFullSync, bool>>(),
            behaviour => behaviour is ValidationBehaviour<PushFullSync, bool>);
    }
}
