using System.Linq.Expressions;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Api.Authorization;
using Application.Bases.Models;
using Application.FeatureFlags;
using Application.Services;
using Domain.FeatureFlags;
using Domain.Policies;
using Domain.Resources;
using Domain.Segments;
using Mediator;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Moq;

namespace Application.IntegrationTests.Controllers;

[Trait("Category", "Host")]
[Collection(nameof(TestApp))]
public class FlagComparisonTests
{
    public static IEnumerable<object[]> DeniedCases()
    {
        foreach (var overview in new[] { false, true })
        foreach (var source in new[] { false, true })
        foreach (var failure in new[] { "foreign", "no-access" })
            yield return [overview, source, failure];
    }

    [Theory]
    [MemberData(nameof(DeniedCases))]
    public async Task RejectsUnauthorizedEnvironmentBeforeReadingFlags(bool overview, bool source, string failure)
    {
        await using var app = new FlagComparisonTestApp { FailSource = source, Failure = failure };
        var client = await app.CreateAuthenticatedClientAsync();
        var response = await SendAsync(client, app, overview);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        app.Flags.VerifyNoOtherCalls();
        app.ResourcesV2.VerifyNoOtherCalls();
        // In a batch, the first target is allowed and the second is rejected.
        if (overview && !source)
            app.TargetResolver.Verify(x => x.ResolveEnvironmentAsync(app.AllowedTarget), Times.Once);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task AllowsAccessibleEnvironments(bool overview)
    {
        await using var app = new FlagComparisonTestApp();
        var client = await app.CreateAuthenticatedClientAsync();
        var response = await SendAsync(client, app, overview);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        app.TargetResolver.Verify(x => x.ResolveEnvironmentAsync(app.Source), Times.Once);
        app.TargetResolver.Verify(x => x.ResolveEnvironmentAsync(app.Target), Times.Once);
        if (overview)
            app.TargetResolver.Verify(x => x.ResolveEnvironmentAsync(app.AllowedTarget), Times.Once);
        using var payload = await response.Content.ReadFromJsonAsync<JsonDocument>();
        var data = payload!.RootElement.GetProperty("data");
        if (overview)
        {
            var flag = Assert.Single(data.GetProperty("items").EnumerateArray());
            Assert.Equal("flag", flag.GetProperty("key").GetString());
            var diff = Assert.Single(flag.GetProperty("diffs").EnumerateArray());
            Assert.Equal(app.Target, diff.GetProperty("targetEnvId").GetGuid());
        }
        else
        {
            Assert.Equal(app.Source, data.GetProperty("source").GetProperty("envId").GetGuid());
            Assert.Equal(app.Target, data.GetProperty("target").GetProperty("envId").GetGuid());
        }
    }

    private static Task<HttpResponseMessage> SendAsync(HttpClient client, FlagComparisonTestApp app, bool overview) =>
        overview
            ? client.PostAsJsonAsync($"/api/v1/envs/{app.Source}/feature-flags/compare-overview", new
            {
                targetEnvIds = new[] { app.AllowedTarget, app.Target, app.AllowedTarget }, filter = new { },
                // Client-supplied authorization context must not override the trusted context.
                orgId = Guid.NewGuid(), permissions = new[] { new PolicyStatement
                { Effect = EffectType.Allow, Actions = ["*"], Resources = ["*"] } }
            })
            : client.GetAsync($"/api/v1/envs/{app.Source}/feature-flags/flag/compare-with/{app.Target}");
}

public class FlagComparisonTestApp : PermissionCheckTestApp
{
    public Guid Source { get; } = Guid.NewGuid();
    public Guid Target { get; } = Guid.NewGuid();
    public Guid AllowedTarget { get; } = Guid.NewGuid();
    public bool FailSource { get; init; }
    public string Failure { get; init; } = "";
    public Mock<IPermissionTargetResolver> TargetResolver { get; } = new();
    public Mock<IResourceServiceV2> ResourcesV2 { get; } = new();
    public Mock<IFeatureFlagService> Flags { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.ConfigureServices(services =>
        {
            var deniedEnv = FailSource ? Source : Target;
            string Rn(Guid id) => $"project/p:env/{id}";
            foreach (var env in new[] { Source, Target, AllowedTarget })
            {
                PermissionTarget? resource = new(Rn(env), TestWorkspace.OrganizationId);
                if (env == deniedEnv && Failure == "foreign")
                    resource = new(Rn(env), Guid.NewGuid());
                TargetResolver.Setup(x => x.ResolveEnvironmentAsync(env)).ReturnsAsync(resource);
            }
            var statements = new List<PolicyStatement>();
            foreach (var env in new[] { Source, Target, AllowedTarget })
                if (env != deniedEnv || Failure != "no-access")
                    statements.Add(new() { ResourceType = ResourceTypes.Env, Effect = EffectType.Allow,
                        Actions = [Permissions.CanAccessEnv], Resources = [Rn(env)] });
            var sourceFlag = NewFlag(Source);
            var targetFlag = NewFlag(Target);
            Flags.Setup(x => x.GetAsync(Source, "flag")).ReturnsAsync(sourceFlag);
            Flags.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<FeatureFlag, bool>>>()))
                .ReturnsAsync(targetFlag);
            Flags.Setup(x => x.GetListAsync(Source, It.IsAny<FeatureFlagFilter>()))
                .ReturnsAsync(new PagedResult<FeatureFlag>(1, [sourceFlag]));
            Flags.Setup(x => x.FindManyAsync(It.IsAny<Expression<Func<FeatureFlag, bool>>>()))
                .ReturnsAsync([targetFlag]);
            Flags.Setup(x => x.GetRelatedSegmentsAsync(It.IsAny<ICollection<FeatureFlag>>())).ReturnsAsync(Array.Empty<Segment>());
            ResourcesV2.Setup(x => x.GetRNAsync(Target, ResourceTypes.Env)).ReturnsAsync($"organization/o:{Rn(Target)}");
            var members = new Mock<IMemberService>();
            members.Setup(x => x.GetPermissionsAsync(TestWorkspace.OrganizationId, TestUser.Id)).ReturnsAsync(statements.ToArray());
            var license = new Mock<ILicenseService>();
            license.Setup(x => x.IsFeatureGrantedAsync(It.IsAny<Guid>(), It.IsAny<string>())).ReturnsAsync(true);
            services.Replace(ServiceDescriptor.Singleton(TargetResolver.Object));
            services.Replace(ServiceDescriptor.Singleton(ResourcesV2.Object));
            services.Replace(ServiceDescriptor.Singleton(Flags.Object));
            services.Replace(ServiceDescriptor.Singleton(members.Object));
            services.Replace(ServiceDescriptor.Singleton(license.Object));
            services.Replace(ServiceDescriptor.Scoped<IPermissionChecker, DefaultPermissionChecker>());
            services.Replace(ServiceDescriptor.Scoped<ISender>(sp => sp.GetRequiredService<IMediator>()));
        });
    }

    private static FeatureFlag NewFlag(Guid env) => new(env, "Flag", "", "flag", false, VariationTypes.Boolean,
        [new() { Id = "off", Value = "false" }, new() { Id = "on", Value = "true" }], "off", "on", [], Guid.NewGuid())
        { Id = Guid.NewGuid() };
}
