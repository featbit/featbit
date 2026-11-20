using System.Linq.Expressions;
using System.Net;
using System.Net.Http.Json;
using Api.Authorization;
using Application.FeatureFlags;
using Application.Services;
using Domain.EndUsers;
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
public class FlagCopyTests
{
    [Theory]
    [InlineData("copy", "null")]
    [InlineData("preview", "null")]
    [InlineData("copy", "empty")]
    [InlineData("preview", "empty")]
    [InlineData("copy", "source")]
    [InlineData("preview", "source")]
    [InlineData("settings", "source")]
    [InlineData("copy", "target")]
    [InlineData("preview", "target")]
    [InlineData("settings", "target")]
    [InlineData("copy", "same")]
    [InlineData("preview", "same")]
    [InlineData("settings", "same")]
    [InlineData("settings", "options")]
    public async Task InvalidInputReturns400BeforeResourceQueries(string operation, string invalid)
    {
        await using var app = new FlagCopyTestApp();
        var client = await app.CreateAuthenticatedClientAsync();
        var source = invalid == "source" ? Guid.Empty : app.Source;
        var target = invalid == "target" ? Guid.Empty : invalid == "same" ? source : app.Target;
        Guid[]? ids = invalid == "null" ? null : invalid == "empty" ? [] : [app.Flag.Id];
        HttpResponseMessage response;
        if (operation == "settings")
            response = await client.PutAsJsonAsync($"/api/v1/envs/{source}/feature-flags/flag/copy-settings-to/{target}", new
            {
                options = invalid == "options" ? null : new FlagSettingCopyOptions(false,
                    new(false, CopyModes.Overwrite), new(false, CopyModes.Overwrite), false, false)
            });
        else
        {
            object? body = operation == "copy" ? new { flagIds = ids } : ids;
            response = await client.PostAsJsonAsync($"/api/v1/envs/{source}/feature-flags/{(operation == "copy" ? "copy-to-env" : "copy-to-env-precheck")}/{target}", body);
        }
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        app.Resources.VerifyNoOtherCalls(); app.Flags.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData("copy-to-env", "source-access")]
    [InlineData("copy-to-env-precheck", "source-access")]
    [InlineData("copy-to-env", "target-access")]
    [InlineData("copy-to-env-precheck", "target-access")]
    [InlineData("copy-to-env", "flag")]
    [InlineData("copy-to-env-precheck", "flag")]
    [InlineData("copy-to-env", "foreign")]
    [InlineData("copy-to-env-precheck", "foreign")]
    public async Task AuthorizationFailureReturns403WithoutWrites(string operation, string denied)
    {
        await using var app = new FlagCopyTestApp { Denied = denied };
        var client = await app.CreateAuthenticatedClientAsync();
        object body = operation == "copy-to-env" ? new { flagIds = new[] { app.Flag.Id } } : new[] { app.Flag.Id };
        var response = await client.PostAsJsonAsync($"/api/v1/envs/{app.Source}/feature-flags/{operation}/{app.Target}", body);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        app.Flags.Verify(x => x.AddOneAsync(It.IsAny<FeatureFlag>()), Times.Never);
        app.Users.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task PrecheckAcceptsSpecificSourceFlagPermissionWithoutWildcardPermission()
    {
        await using var app = new FlagCopyTestApp();
        var client = await app.CreateAuthenticatedClientAsync();
        var response = await client.PostAsJsonAsync($"/api/v1/envs/{app.Source}/feature-flags/copy-to-env-precheck/{app.Target}", new[] { app.Flag.Id });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        app.Flags.Verify(x => x.FindManyAsync(It.IsAny<Expression<Func<FeatureFlag, bool>>>()), Times.Exactly(2));
    }
}

public class FlagCopyTestApp : PermissionCheckTestApp
{
    public Guid Source { get; } = Guid.NewGuid();
    public Guid Target { get; } = Guid.NewGuid();
    public string Denied { get; init; } = "";
    public FeatureFlag Flag { get; }
    public Mock<IResourceService> Resources { get; } = new();
    public Mock<IFeatureFlagService> Flags { get; } = new();
    public Mock<IEndUserService> Users { get; } = new();
    public FlagCopyTestApp() => Flag = new FeatureFlag(Source, "Flag", "", "flag", false, VariationTypes.Boolean,
        [new() { Id = "off", Value = "false" }, new() { Id = "on", Value = "true" }], "off", "on", [], Guid.NewGuid()) { Id = Guid.NewGuid() };

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.ConfigureServices(services =>
        {
            Resources.Setup(x => x.GetEnvRnAsync(Source)).ReturnsAsync(new ResourceRn("project/p:env/source", TestWorkspace.OrganizationId));
            Resources.Setup(x => x.GetEnvRnAsync(Target)).ReturnsAsync(new ResourceRn("project/p:env/target",
                Denied == "foreign" ? Guid.NewGuid() : TestWorkspace.OrganizationId));
            Flags.Setup(x => x.FindManyAsync(It.IsAny<Expression<Func<FeatureFlag, bool>>>()))
                .ReturnsAsync((Expression<Func<FeatureFlag, bool>> predicate) => new[] { Flag }.Where(predicate.Compile()).ToArray());
            Flags.Setup(x => x.GetRelatedSegmentsAsync(It.IsAny<ICollection<FeatureFlag>>())).ReturnsAsync(Array.Empty<Segment>());
            Users.Setup(x => x.GetPropertiesAsync(Target)).ReturnsAsync(Array.Empty<EndUserProperty>());
            var resourcesV2 = new Mock<IResourceServiceV2>();
            resourcesV2.Setup(x => x.GetRNAsync(Target, ResourceTypes.Env)).ReturnsAsync("organization/o:project/p:env/target");
            var statements = new List<PolicyStatement>
            {
                new() { ResourceType = ResourceTypes.Env, Effect = EffectType.Allow, Actions = [Permissions.CanAccessEnv], Resources = ["project/p:env/*"] },
                new() { ResourceType = ResourceTypes.FeatureFlag, Effect = EffectType.Allow, Actions = [Permissions.CopyFlagTo], Resources = ["project/p:env/source:flag/flag"] }
            };
            if (Denied is "source-access" or "target-access" or "flag")
                statements.Add(new PolicyStatement
                {
                    ResourceType = Denied == "flag" ? ResourceTypes.FeatureFlag : ResourceTypes.Env, Effect = EffectType.Deny,
                    Actions = [Denied == "flag" ? Permissions.CopyFlagTo : Permissions.CanAccessEnv],
                    Resources = [Denied == "flag" ? "project/p:env/source:flag/flag" : Denied == "source-access" ? "project/p:env/source" : "project/p:env/target"]
                });
            var members = new Mock<IMemberService>();
            members.Setup(x => x.GetPermissionsAsync(TestWorkspace.OrganizationId, TestUser.Id)).ReturnsAsync(statements.ToArray());
            var license = new Mock<ILicenseService>();
            license.Setup(x => x.IsFeatureGrantedAsync(It.IsAny<Guid>(), It.IsAny<string>())).ReturnsAsync(true);
            services.Replace(ServiceDescriptor.Singleton(Resources.Object));
            services.Replace(ServiceDescriptor.Singleton(Flags.Object));
            services.Replace(ServiceDescriptor.Singleton(Users.Object));
            services.Replace(ServiceDescriptor.Singleton(resourcesV2.Object));
            services.Replace(ServiceDescriptor.Singleton(members.Object));
            services.Replace(ServiceDescriptor.Singleton(license.Object));
            services.Replace(ServiceDescriptor.Scoped<IPermissionChecker, DefaultPermissionChecker>());
            services.Replace(ServiceDescriptor.Scoped<ISender>(sp => sp.GetRequiredService<IMediator>()));
        });
    }
}
