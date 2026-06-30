using Infrastructure.Persistence;
using Infrastructure.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Infrastructure.UnitTests.Services;

public class RelayProxyAppServiceTests
{
    private static RelayProxyAppService Create(string dbProviderName)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["DbProvider"] = dbProviderName })
            .Build();
        var serviceProvider = new ServiceCollection().BuildServiceProvider();
        return new RelayProxyAppService(configuration, serviceProvider);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("not-rp-prefixed")]
    public async Task GetWorkspaceAsync_KeyMissingRelayProxyPrefix_ReturnsNullWithoutTouchingDb(string key)
    {
        var service = Create(DbProvider.Postgres);

        var workspace = await service.GetWorkspaceAsync(key);

        Assert.Null(workspace);
    }

    [Fact]
    public async Task GetWorkspaceAsync_UnknownProvider_ReturnsNull()
    {
        var service = Create("Bogus");

        var workspace = await service.GetWorkspaceAsync("rp-test");

        Assert.Null(workspace);
    }

    [Fact]
    public async Task CheckQuotaAsync_UnknownProvider_TreatsUsageAsIntMaxAndReturnsFalse()
    {
        var service = Create("Bogus");
        // License = null falls back to WorkspaceConstants.DefaultAllowedAutoAgents (9).
        var workspace = new Domain.Workspaces.Workspace { Id = Guid.NewGuid(), License = null };

        var withinQuota = await service.CheckQuotaAsync(workspace);

        // unknown provider falls through to int.MaxValue usage -> always out of quota
        Assert.False(withinQuota);
    }

    [Fact]
    public async Task RegisterAgentAsync_UnsupportedProvider_NoOps()
    {
        // Mongo/Postgres branches require real DB connections and are covered by integration tests.
        var service = Create("Bogus");

        var ex = await Record.ExceptionAsync(() => service.RegisterAgentAsync("rp-test", "agent-1"));

        Assert.Null(ex);
    }
}
