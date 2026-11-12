using System.Linq.Expressions;
using System.Net;
using System.Net.Http.Json;
using Api;
using Api.Authorization;
using Api.Filters;
using Application.FeatureFlags;
using Application.Services;
using Application.Segments;
using Domain.AccessTokens;
using Domain.FeatureFlags;
using Domain.Organizations;
using Domain.Policies;
using Domain.Resources;
using Domain.Segments;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Moq;

namespace Application.IntegrationTests.Controllers;

[Trait("Category", "Host")]
[Collection(nameof(TestApp))]
public class ResourceOrganizationAuthorizationTests(TestApp app)
{
    private static readonly Guid OrganizationA = Guid.NewGuid();
    private static readonly Guid OrganizationB = Guid.NewGuid();
    private static readonly Guid WorkspaceA = Guid.NewGuid();
    private static readonly Guid WorkspaceB = Guid.NewGuid();
    private static readonly Guid ProjectA = Guid.NewGuid();
    private static readonly Guid ProjectB = Guid.NewGuid();
    private static readonly Guid OtherProjectA = Guid.NewGuid();
    private static readonly Guid EnvA = Guid.NewGuid();
    private static readonly Guid EnvB = Guid.NewGuid();
    private static readonly Guid OtherEnvA = Guid.NewGuid();
    private static readonly Guid ForeignSegment = Guid.NewGuid();
    private static readonly Guid OwnSegment = Guid.NewGuid();

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task SegmentBatch_ExistingAndDeletedIds_ReturnsExistingNames(bool openApi)
    {
        var deleted = Guid.NewGuid();
        var sender = new Mock<ISender>(MockBehavior.Strict);
        sender.Setup(x => x.Send(It.Is<GetSegmentByIds>(r => r.Ids.Contains(OwnSegment) && r.Ids.Contains(deleted)),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync([new Segment { Id = OwnSegment, Name = "Existing audit segment", EnvId = EnvA }]);
        using var factory = CreateFactory(sender);
        using var client = await CreateClientAsync(factory, openApi);

        using var response = await client.GetAsync($"/api/v1/envs/{EnvA}/segments/by-ids?ids={OwnSegment}&ids={deleted}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("Existing audit segment", await response.Content.ReadAsStringAsync());
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task ResourceEndpoints_ForeignIdsWithCollidingKeys_Return403WithoutDispatch(bool openApi)
    {
        var sender = new Mock<ISender>(MockBehavior.Strict);
        using var factory = CreateFactory(sender);
        using var client = await CreateClientAsync(factory, openApi);
        var requests = new (HttpMethod method, string path, object? body)[]
        {
            (HttpMethod.Get, $"envs/{EnvB}/feature-flags/flag", null),
            (HttpMethod.Put, $"envs/{EnvB}/feature-flags/flag/name", new { name = "changed" }),
            (HttpMethod.Patch, $"envs/{EnvB}/feature-flags/flag", new[] { new { op = "replace", path = "/description", value = "changed" } }),
            (HttpMethod.Get, $"projects/{ProjectB}", null),
            (HttpMethod.Get, $"projects/{ProjectA}/envs/{EnvB}", null),
            (HttpMethod.Get, $"projects/{ProjectA}/envs/{OtherEnvA}", null),
            (HttpMethod.Get, $"envs/{EnvA}/segments/{ForeignSegment}", null),
            (HttpMethod.Get, $"envs/{EnvA}/segments/by-ids?ids={ForeignSegment}", null),
            (HttpMethod.Get, $"envs/{EnvA}/segments/by-ids?ids={OwnSegment}&ids={ForeignSegment}", null),
            (HttpMethod.Get, $"envs/{EnvA}/feature-flags/flag/compare-with/{EnvB}", null),
            (HttpMethod.Post, $"envs/{EnvA}/feature-flags/compare-overview", new { targetEnvIds = new[] { EnvB }, filter = new { } }),
            (HttpMethod.Post, $"envs/{EnvA}/feature-flags/copy-to-env-precheck/{EnvB}", Array.Empty<Guid>())
        };

        foreach (var (method, path, body) in requests)
        {
            using var request = new HttpRequestMessage(method, "/api/v1/" + path);
            if (body != null) request.Content = JsonContent.Create(body);
            using var response = await client.SendAsync(request);

            Assert.True(response.StatusCode == HttpStatusCode.Forbidden,
                $"{method} {path}: {response.StatusCode} {await response.Content.ReadAsStringAsync()}");
        }
        sender.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task ResourceEndpoints_OwnOrganization_DispatchesNormally(bool openApi)
    {
        var sender = new Mock<ISender>(MockBehavior.Strict);
        sender.Setup(x => x.Send(It.Is<GetFeatureFlag>(r => r.EnvId == EnvA), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new FeatureFlag { Id = Guid.NewGuid(), EnvId = EnvA, Key = "flag" });
        using var factory = CreateFactory(sender);
        using var client = await CreateClientAsync(factory, openApi);

        using var response = await client.GetAsync($"/api/v1/envs/{EnvA}/feature-flags/flag");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        sender.Verify(x => x.Send(It.IsAny<GetFeatureFlag>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task ResourceEndpoints_ForgedWorkspaceHeader_CannotChangeEffectiveScope(bool openApi)
    {
        var sender = new Mock<ISender>();
        sender.Setup(x => x.Send(It.IsAny<GetFeatureFlag>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new FeatureFlag { Id = Guid.NewGuid(), EnvId = EnvA, Key = "flag" });
        using var factory = CreateFactory(sender);
        using var client = await CreateClientAsync(factory, openApi);
        client.DefaultRequestHeaders.Remove(ApiConstants.WorkspaceHeaderKey);
        client.DefaultRequestHeaders.Add(ApiConstants.WorkspaceHeaderKey, WorkspaceB.ToString());
        if (openApi)
        {
            client.DefaultRequestHeaders.Remove(ApiConstants.OrgIdHeaderKey);
            client.DefaultRequestHeaders.Add(ApiConstants.OrgIdHeaderKey, OrganizationB.ToString());
        }

        using var response = await client.GetAsync($"/api/v1/envs/{EnvA}/feature-flags/flag");

        Assert.Equal(openApi ? HttpStatusCode.OK : HttpStatusCode.Forbidden, response.StatusCode);
        sender.Verify(x => x.Send(It.IsAny<GetFeatureFlag>(), It.IsAny<CancellationToken>()),
            openApi ? Times.Once : Times.Never);
    }

    private Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> CreateFactory(Mock<ISender> sender)
    {
        var resources = new Mock<IResourceService>();
        resources.Setup(x => x.GetOrganizationWorkspaceIdAsync(OrganizationA)).ReturnsAsync(WorkspaceA);
        resources.Setup(x => x.GetOrganizationWorkspaceIdAsync(OrganizationB)).ReturnsAsync(WorkspaceB);
        resources.Setup(x => x.IsProjectInOrganizationAsync(It.IsAny<Guid>(), It.IsAny<Guid>()))
            .ReturnsAsync((Guid organization, Guid project) => organization == OrganizationA && (project == ProjectA || project == OtherProjectA));
        resources.Setup(x => x.IsEnvInOrganizationAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid?>()))
            .ReturnsAsync((Guid organization, Guid env, Guid? project) =>
                organization == OrganizationA &&
                ((env == EnvA && (project == null || project == ProjectA)) ||
                 (env == OtherEnvA && (project == null || project == OtherProjectA))));
        resources.Setup(x => x.GetProjectRnAsync(It.IsAny<Guid>())).ReturnsAsync("project/shared");
        resources.Setup(x => x.GetEnvRnAsync(It.IsAny<Guid>())).ReturnsAsync("project/shared:env/dev");
        resources.Setup(x => x.GetFlagRnAsync(It.IsAny<Guid>(), It.IsAny<string>()))
            .ReturnsAsync("project/shared:env/dev:flag/flag");
        resources.Setup(x => x.GetSegmentRnAsync(EnvA, OwnSegment)).ReturnsAsync("project/shared:env/dev:segment/own");
        resources.Setup(x => x.SegmentExistsAsync(ForeignSegment)).ReturnsAsync(true);
        PolicyStatement[] policies = [new() { Effect = EffectType.Allow, Actions = ["*"], Resources = ["*"] }];
        var members = new Mock<IMemberService>();
        members.Setup(x => x.GetPermissionsAsync(OrganizationA, It.IsAny<Guid>())).ReturnsAsync(policies);
        members.Setup(x => x.GetPermissionsAsync(OrganizationB, It.IsAny<Guid>())).ReturnsAsync([]);
        var token = new AccessToken(OrganizationA, Guid.NewGuid(), "test", AccessTokenTypes.Service, policies)
            { Token = "scope-test-token" };
        var tokens = new Mock<IAccessTokenService>();
        tokens.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<AccessToken, bool>>>())).ReturnsAsync(token);
        var organizations = new Mock<IOrganizationService>();
        organizations.Setup(x => x.GetAsync(OrganizationA)).ReturnsAsync(new Organization(WorkspaceA, "org", "org") { Id = OrganizationA });
        var licenses = new Mock<ILicenseService>();
        licenses.Setup(x => x.IsFeatureGrantedAsync(It.IsAny<Guid>(), It.IsAny<string>())).ReturnsAsync(true);

        return app.WithServices(services =>
        {
            services.Replace(ServiceDescriptor.Scoped<ResourceOrganizationFilter, ResourceOrganizationFilter>());
            services.Replace(ServiceDescriptor.Scoped<IPermissionChecker, DefaultPermissionChecker>());
            services.Replace(ServiceDescriptor.Scoped<IRequestPermissions, RequestPermissions>());
            services.Replace(ServiceDescriptor.Singleton(resources.Object));
            services.Replace(ServiceDescriptor.Singleton(members.Object));
            services.Replace(ServiceDescriptor.Singleton(tokens.Object));
            services.Replace(ServiceDescriptor.Singleton(organizations.Object));
            services.Replace(ServiceDescriptor.Singleton(licenses.Object));
            services.Replace(ServiceDescriptor.Singleton(sender.Object));
        });
    }

    private async Task<HttpClient> CreateClientAsync(Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> factory,
        bool openApi)
    {
        var client = openApi ? factory.CreateClient() : await app.CreateAuthenticatedClientAsync(factory);
        if (openApi) client.DefaultRequestHeaders.Add("Authorization", "scope-test-token");
        client.DefaultRequestHeaders.Add(ApiConstants.OrgIdHeaderKey, OrganizationA.ToString());
        client.DefaultRequestHeaders.Add(ApiConstants.WorkspaceHeaderKey, WorkspaceA.ToString());
        return client;
    }
}
