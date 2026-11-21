using System.Linq.Expressions;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Application.ObservabilityProviders;
using Application.Services;
using Domain.AccessTokens;
using Domain.Environments;
using Domain.Policies;
using Domain.Resources;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Moq;

namespace Application.IntegrationTests.Controllers;

[Trait("Category", "Host")]
[Collection(nameof(TestApp))]
public class ObservabilityProviderAuthorizationTests(TestApp app)
{
    private static readonly Guid EnvId = Guid.NewGuid();
    private static readonly string CollectionPath = $"/api/v1/envs/{EnvId}/observability-providers";
    private static readonly string ItemPath = $"{CollectionPath}/{Guid.NewGuid()}";
    private static readonly object Payload = new
    {
        name = "Production metrics",
        providerType = "prometheus-compatible",
        providerSchemaVersion = 1,
        providerConfig = new { endpoint = "https://metrics.example.com" },
        authentication = new { type = "none" }
    };

    [Theory]
    [InlineData(false, true, true)] // User is outside the organization.
    [InlineData(true, false, true)] // Matching resource keys in another organization.
    [InlineData(true, true, false)] // Explicit write permission without environment access.
    public async Task CrudRequiresOrganizationMembershipAndEnvironmentAccess(
        bool member, bool ownsEnvironment, bool canAccess)
    {
        var orgs = TestTenantContext.CreateOrganizationService();
        orgs.Setup(x => x.ContainsUserAsync(TestWorkspace.OrganizationId, TestUser.Id)).ReturnsAsync(member);
        var sender = new Mock<ISender>(MockBehavior.Strict);
        var members = MemberService(canAccess
            ? [Permissions.CanAccessEnv, Permissions.UpdateEnvSettings]
            : [Permissions.UpdateEnvSettings]);
        using var factory = app.WithServices(services =>
        {
            services.Replace(ServiceDescriptor.Singleton(orgs.Object));
            services.Replace(ServiceDescriptor.Singleton(members.Object));
            services.Replace(ServiceDescriptor.Singleton(EnvironmentService(ownsEnvironment).Object));
            services.Replace(ServiceDescriptor.Singleton(sender.Object));
        });
        using var client = await app.CreateAuthenticatedClientAsync(factory, includeTenantContext: true);

        using var list = await client.GetAsync(CollectionPath);
        Assert.Equal(HttpStatusCode.Forbidden, list.StatusCode);
        using var get = await client.GetAsync(ItemPath);
        Assert.Equal(HttpStatusCode.Forbidden, get.StatusCode);
        await AssertWritesForbiddenAsync(client);
        sender.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData(AccessTokenTypes.Service, false, HttpStatusCode.OK)]
    [InlineData(AccessTokenTypes.Personal, true, HttpStatusCode.OK)]
    [InlineData(AccessTokenTypes.Personal, false, HttpStatusCode.Forbidden)]
    public async Task ReadOnlyTokenIsScopedToItsOrganizationAndPersonalTokensRequireCurrentMembership(
        string type, bool creatorIsMember, HttpStatusCode listStatus)
    {
        var token = new AccessToken(TestWorkspace.OrganizationId, TestUser.Id, "reader", type,
            [EnvironmentPolicy([Permissions.CanAccessEnv])]);
        var tokens = new Mock<IAccessTokenService>();
        tokens.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<AccessToken, bool>>>())).ReturnsAsync(token);
        var orgs = TestTenantContext.CreateOrganizationService();
        orgs.Setup(x => x.ContainsUserAsync(TestWorkspace.OrganizationId, TestUser.Id)).ReturnsAsync(creatorIsMember);
        var sender = new Mock<ISender>(MockBehavior.Strict);
        sender.Setup(x => x.Send(It.Is<GetObservabilityProviderList>(q => q.EnvId == EnvId), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<ObservabilityProviderVm>());
        var environments = EnvironmentService(true);
        var foreignEnvId = Guid.NewGuid();
        environments.Setup(x => x.GetResourceDescriptorAsync(foreignEnvId))
            .ReturnsAsync(Descriptor(foreignEnvId, Guid.NewGuid()));
        using var factory = app.WithServices(services =>
        {
            services.Replace(ServiceDescriptor.Singleton(tokens.Object));
            services.Replace(ServiceDescriptor.Singleton(orgs.Object));
            services.Replace(ServiceDescriptor.Singleton(MemberService([Permissions.CanAccessEnv]).Object));
            services.Replace(ServiceDescriptor.Singleton(environments.Object));
            services.Replace(ServiceDescriptor.Singleton(sender.Object));
        });
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(token.Token);

        using var list = await client.GetAsync(CollectionPath);
        Assert.Equal(listStatus, list.StatusCode);
        await AssertWritesForbiddenAsync(client);
        using var foreign = await client.GetAsync($"/api/v1/envs/{foreignEnvId}/observability-providers");
        Assert.Equal(HttpStatusCode.Forbidden, foreign.StatusCode);
        sender.Verify(x => x.Send(It.Is<GetObservabilityProviderList>(q => q.EnvId == EnvId), It.IsAny<CancellationToken>()),
            listStatus == HttpStatusCode.OK ? Times.Once() : Times.Never());
        sender.VerifyNoOtherCalls();
    }

    private static async Task AssertWritesForbiddenAsync(HttpClient client)
    {
        using var create = await client.PostAsJsonAsync(CollectionPath, Payload);
        Assert.Equal(HttpStatusCode.Forbidden, create.StatusCode);
        using var update = await client.PutAsJsonAsync(ItemPath, Payload);
        Assert.Equal(HttpStatusCode.Forbidden, update.StatusCode);
        using var delete = await client.DeleteAsync(ItemPath);
        Assert.Equal(HttpStatusCode.Forbidden, delete.StatusCode);
    }

    private static Mock<IMemberService> MemberService(string[] actions)
    {
        var members = new Mock<IMemberService>();
        members.Setup(x => x.GetPermissionsAsync(TestWorkspace.OrganizationId, TestUser.Id))
            .ReturnsAsync([EnvironmentPolicy(actions)]);
        return members;
    }

    private static PolicyStatement EnvironmentPolicy(string[] actions) => new()
    {
        ResourceType = ResourceTypes.Env,
        Effect = "allow",
        Resources = ["project/checkout:env/production"],
        Actions = actions
    };

    private static Mock<IEnvironmentService> EnvironmentService(bool owned)
    {
        var environments = new Mock<IEnvironmentService>();
        environments.Setup(x => x.GetResourceDescriptorAsync(EnvId))
            .ReturnsAsync(Descriptor(EnvId, owned ? TestWorkspace.OrganizationId : Guid.NewGuid()));
        return environments;
    }

    private static ResourceDescriptor Descriptor(Guid envId, Guid orgId) => new()
    {
        Organization = new() { Id = orgId },
        Project = new() { Key = "checkout" },
        Environment = new() { Id = envId, Key = "production" }
    };
}
