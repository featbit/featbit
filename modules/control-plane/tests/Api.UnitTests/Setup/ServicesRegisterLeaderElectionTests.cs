using Api.Application.ControlPlane;
using Api.Setup;
using Infrastructure.Caches.Redis;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace Api.UnitTests.Setup;

/// <summary>
/// #71 leader election is opt-in (default off, <c>ControlPlane:LeaderElection:Enabled</c>). These
/// tests exercise <see cref="ServicesRegister.AddLeaderElection"/> directly — the conditional DI
/// seam extracted from <see cref="ServicesRegister.RegisterServices"/> — rather than the whole
/// <c>WebApplicationBuilder</c> pipeline (which needs a live Mongo/Postgres/Redis to build).
/// </summary>
public sealed class ServicesRegisterLeaderElectionTests
{
    private static IConfiguration CreateConfiguration(bool? enabled)
    {
        var data = new Dictionary<string, string?>();
        if (enabled.HasValue)
        {
            data["ControlPlane:LeaderElection:Enabled"] = enabled.Value.ToString();
        }

        return new ConfigurationBuilder().AddInMemoryCollection(data).Build();
    }

    [Fact]
    public void Unset_DefaultsToDisabled_RegistersAlwaysLeaderElection_NotRedisLeaderElector()
    {
        var services = new ServiceCollection();

        ServicesRegister.AddLeaderElection(services, CreateConfiguration(enabled: null));

        Assert.Contains(services, d => d.ServiceType == typeof(AlwaysLeaderElection));
        Assert.DoesNotContain(services, d => d.ServiceType == typeof(RedisLeaderElector));
    }

    [Fact]
    public void ExplicitlyDisabled_RegistersAlwaysLeaderElection_AsILeaderElectionAndHostedService()
    {
        var services = new ServiceCollection();
        ServicesRegister.AddLeaderElection(services, CreateConfiguration(enabled: false));

        Assert.DoesNotContain(services, d => d.ServiceType == typeof(RedisLeaderElector));

        services.AddSingleton<ILogger<AlwaysLeaderElection>>(NullLogger<AlwaysLeaderElection>.Instance);
        using var provider = services.BuildServiceProvider();

        var leaderElection = provider.GetRequiredService<ILeaderElection>();
        Assert.IsType<AlwaysLeaderElection>(leaderElection);
        Assert.True(leaderElection.IsLeader);

        var hostedServices = provider.GetServices<IHostedService>().ToList();
        Assert.Contains(hostedServices, hs => ReferenceEquals(hs, leaderElection));

        // No RedisLeaderElector hosted service is registered at all when disabled.
        Assert.DoesNotContain(hostedServices, hs => hs is RedisLeaderElector);
    }

    [Fact]
    public void Enabled_RegistersRedisLeaderElector_AsAllThreeResolvingSameInstance()
    {
        var services = new ServiceCollection();
        var configuration = CreateConfiguration(enabled: true);

        ServicesRegister.AddLeaderElection(services, configuration);

        Assert.Contains(services, d => d.ServiceType == typeof(RedisLeaderElector));
        Assert.DoesNotContain(services, d => d.ServiceType == typeof(AlwaysLeaderElection));

        // RedisLeaderElector's constructor only stores these references (Redis is never touched
        // until ExecuteAsync/StopAsync run), so a mock IRedisClient is sufficient here.
        services.AddSingleton(configuration);
        services.AddSingleton(Mock.Of<IRedisClient>());
        services.AddSingleton<ILogger<RedisLeaderElector>>(NullLogger<RedisLeaderElector>.Instance);

        using var provider = services.BuildServiceProvider();

        var leaderElection = provider.GetRequiredService<ILeaderElection>();
        Assert.IsType<RedisLeaderElector>(leaderElection);

        var singleton = provider.GetRequiredService<RedisLeaderElector>();
        Assert.Same(singleton, leaderElection);

        var hostedServices = provider.GetServices<IHostedService>().ToList();
        Assert.Contains(hostedServices, hs => ReferenceEquals(hs, leaderElection));
        Assert.DoesNotContain(hostedServices, hs => hs is AlwaysLeaderElection);
    }
}
