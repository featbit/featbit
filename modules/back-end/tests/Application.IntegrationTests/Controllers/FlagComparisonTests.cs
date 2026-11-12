using System.Linq.Expressions;
using System.Net;
using System.Net.Http.Json;
using Api.Authorization;
using Application.Bases.Models;
using Application.FeatureFlags;
using Application.Services;
using Domain.FeatureFlags;
using Domain.Policies;
using Domain.Resources;
using Domain.Segments;
using MediatR;
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
        foreach (var failure in new[] { "foreign", "missing-owner", "missing", "blank", "no-access", "deny" })
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
            app.Resources.Verify(x => x.GetEnvRnAsync(app.AllowedTarget), Times.Once);
    }

    [Theory]
    [InlineData(false, false)]
    [InlineData(true, false)]
    [InlineData(false, true)]
    [InlineData(true, true)]
    public async Task AllowsAccessibleEnvironmentsIncludingMissingTargetFlags(bool overview, bool missingTarget)
    {
        await using var app = new FlagComparisonTestApp { MissingTargetFlag = missingTarget };
        var client = await app.CreateAuthenticatedClientAsync();
        var response = await SendAsync(client, app, overview);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        app.Resources.Verify(x => x.GetEnvRnAsync(app.Source), Times.Once);
        app.Resources.Verify(x => x.GetEnvRnAsync(app.Target), Times.Once);
        if (overview)
            app.Resources.Verify(x => x.GetEnvRnAsync(app.AllowedTarget), Times.Once);
        Assert.NotEmpty(app.Flags.Invocations);
    }

    [Fact]
    public async Task EmptyTargetIdReturns400BeforeResourceQueries()
    {
        await using var app = new FlagComparisonTestApp();
        var client = await app.CreateAuthenticatedClientAsync();
        var response = await client.PostAsJsonAsync($"/api/v1/envs/{app.Source}/feature-flags/compare-overview",
            new { targetEnvIds = new[] { app.Target, Guid.Empty }, filter = new { } });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        app.Resources.VerifyNoOtherCalls();
        app.Flags.VerifyNoOtherCalls();
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
    public bool MissingTargetFlag { get; init; }
    public Mock<IResourceService> Resources { get; } = new();
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
                ResourceRn? resource = new(Rn(env), TestWorkspace.OrganizationId);
                if (env == deniedEnv)
                    resource = Failure switch
                    {
                        "foreign" => new(Rn(env), Guid.NewGuid()),
                        "missing-owner" => new(Rn(env), null),
                        "missing" => null,
                        "blank" => new("", TestWorkspace.OrganizationId),
                        _ => resource
                    };
                Resources.Setup(x => x.GetEnvRnAsync(env)).ReturnsAsync(resource);
            }
            var statements = new List<PolicyStatement>();
            foreach (var env in new[] { Source, Target, AllowedTarget })
                if (env != deniedEnv || Failure != "no-access")
                    statements.Add(new() { ResourceType = ResourceTypes.Env, Effect = EffectType.Allow,
                        Actions = [Permissions.CanAccessEnv], Resources = [Rn(env)] });
            if (Failure == "deny")
                statements.Add(new() { ResourceType = ResourceTypes.Env, Effect = EffectType.Deny,
                    Actions = [Permissions.CanAccessEnv], Resources = [Rn(deniedEnv)] });
            var sourceFlag = NewFlag(Source);
            var targetFlag = NewFlag(Target);
            Flags.Setup(x => x.GetAsync(Source, "flag")).ReturnsAsync(sourceFlag);
            Flags.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<FeatureFlag, bool>>>()))
                .ReturnsAsync(MissingTargetFlag ? null : targetFlag);
            Flags.Setup(x => x.GetListAsync(Source, It.IsAny<FeatureFlagFilter>()))
                .ReturnsAsync(new PagedResult<FeatureFlag>(1, [sourceFlag]));
            Flags.Setup(x => x.FindManyAsync(It.IsAny<Expression<Func<FeatureFlag, bool>>>()))
                .ReturnsAsync(MissingTargetFlag ? [] : [targetFlag]);
            Flags.Setup(x => x.GetRelatedSegmentsAsync(It.IsAny<ICollection<FeatureFlag>>())).ReturnsAsync(Array.Empty<Segment>());
            ResourcesV2.Setup(x => x.GetRNAsync(Target, ResourceTypes.Env)).ReturnsAsync($"organization/o:{Rn(Target)}");
            var members = new Mock<IMemberService>();
            members.Setup(x => x.GetPermissionsAsync(TestWorkspace.OrganizationId, TestUser.Id)).ReturnsAsync(statements.ToArray());
            var license = new Mock<ILicenseService>();
            license.Setup(x => x.IsFeatureGrantedAsync(It.IsAny<Guid>(), It.IsAny<string>())).ReturnsAsync(true);
            services.Replace(ServiceDescriptor.Singleton(Resources.Object));
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
