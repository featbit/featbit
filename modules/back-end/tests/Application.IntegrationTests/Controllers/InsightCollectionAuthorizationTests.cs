using System.Net;
using System.Net.Http.Json;
using Api.Authorization;
using Application.FeatureFlags;
using Application.Services;
using Domain.Policies;
using Domain.Resources;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Moq;

namespace Application.IntegrationTests.Controllers;

[Trait("Category", "Host")]
[Collection(nameof(TestApp))]
public class InsightCollectionAuthorizationTests(TestApp app)
{
    [Theory]
    [InlineData(false, false, HttpStatusCode.Forbidden)]
    [InlineData(true, true, HttpStatusCode.Forbidden)]
    [InlineData(true, false, HttpStatusCode.OK)]
    public async Task UpdateInsightCollectionAsync_FlagPolicies_EnforcesTogglePermission(
        bool allowToggle, bool denyToggle, HttpStatusCode expectedStatus)
    {
        var envId = Guid.NewGuid();
        const string rn = "project/shop:env/prod:flag/checkout";
        var policies = new List<PolicyStatement>
        {
            new()
            {
                ResourceType = ResourceTypes.Env,
                Effect = EffectType.Allow,
                Actions = [Permissions.CanAccessEnv],
                Resources = ["*"]
            }
        };
        if (allowToggle)
        {
            policies.Add(new PolicyStatement
            {
                ResourceType = ResourceTypes.FeatureFlag,
                Effect = EffectType.Allow,
                Actions = [Permissions.ToggleFlag],
                Resources = [rn]
            });
        }
        if (denyToggle)
        {
            policies.Add(new PolicyStatement
            {
                ResourceType = ResourceTypes.FeatureFlag,
                Effect = EffectType.Deny,
                Actions = [Permissions.ToggleFlag],
                Resources = [rn]
            });
        }
        var permissions = new Mock<IRequestPermissions>();
        permissions.Setup(x => x.GetAsync(It.IsAny<HttpContext>())).ReturnsAsync(policies.ToArray());
        var resources = new Mock<IResourceService>();
        resources.Setup(x => x.GetEnvRnAsync(envId)).ReturnsAsync("project/shop:env/prod");
        resources.Setup(x => x.GetFlagRnAsync(envId, "checkout")).ReturnsAsync(rn);
        var sender = new Mock<ISender>(MockBehavior.Strict);
        sender.Setup(x => x.Send(It.IsAny<UpdateInsightCollection>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Guid.NewGuid());
        using var factory = app.WithServices(services =>
        {
            services.Replace(ServiceDescriptor.Scoped<IPermissionChecker, DefaultPermissionChecker>());
            services.Replace(ServiceDescriptor.Singleton(permissions.Object));
            services.Replace(ServiceDescriptor.Singleton(resources.Object));
            services.Replace(ServiceDescriptor.Singleton(sender.Object));
        });
        using var client = await app.CreateAuthenticatedClientAsync(factory);

        var response = await client.PutAsJsonAsync(
            $"/api/v1/envs/{envId}/feature-flags/checkout/insight-collection", new { enabled = false });

        Assert.Equal(expectedStatus, response.StatusCode);
        sender.Verify(x => x.Send(It.IsAny<UpdateInsightCollection>(), It.IsAny<CancellationToken>()),
            expectedStatus == HttpStatusCode.OK ? Times.Once() : Times.Never());
    }
}
