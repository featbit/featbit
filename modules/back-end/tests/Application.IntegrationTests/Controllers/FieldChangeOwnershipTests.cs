using System.Net;
using System.Net.Http.Json;
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
public class FieldChangeOwnershipTests
{
    public static IEnumerable<object[]> Cases =>
        from segment in new[] { false, true }
        from operation in new[] { "general", "targeting", "patch" }
        from changed in new[] { false, true }
        from foreign in new[] { false, true }
        select new object[] { segment, operation, changed, foreign };

    [Theory]
    [MemberData(nameof(Cases))]
    public async Task FieldChangesAndNoOpsRespectOrganizationOwnership(bool segment, string operation, bool changed, bool foreign)
    {
        await using var app = new FieldChangeTestApp { Foreign = foreign };
        var client = await app.CreateAuthenticatedClientAsync();
        var route = segment ? $"segments/{app.Segment.Id}" : "feature-flags/flag";
        var url = $"/api/v1/envs/{app.EnvironmentId}/{route}";
        HttpResponseMessage response;
        if (operation == "patch")
        {
            var patch = changed ? new[] { new { op = "replace", path = "/name", value = "changed" } } : [];
            response = await client.PatchAsJsonAsync(url, patch);
        }
        else
        {
            object body;
            if (operation == "general")
                body = new { name = changed ? "changed" : "Original", description = "", tags = Array.Empty<string>() };
            else if (segment)
                body = new { included = changed ? new[] { "user" } : [], excluded = Array.Empty<string>(), rules = app.Segment.Rules };
            else
                body = new
                {
                    revision = app.Flag.Revision,
                    targeting = new FlagTargeting
                    {
                        DisabledVariationId = changed ? "on" : "off", TargetUsers = app.Flag.TargetUsers,
                        Rules = app.Flag.Rules, Fallthrough = app.Flag.Fallthrough,
                        ExptIncludeAllTargets = app.Flag.ExptIncludeAllTargets
                    }
                };
            response = await client.PutAsJsonAsync(url + "/" + operation, body);
        }
        Assert.Equal(foreign ? HttpStatusCode.Forbidden : HttpStatusCode.OK, response.StatusCode);
        if (segment) app.Resources.Verify(x => x.GetSegmentRnAsync(app.EnvironmentId, app.Segment.Id), Times.Once);
        else app.Resources.Verify(x => x.GetFlagRnAsync(app.EnvironmentId, "flag"), Times.Once);
        if (foreign || (!changed && operation == "general"))
        {
            app.Flags.Verify(x => x.UpdateAsync(It.IsAny<FeatureFlag>()), Times.Never);
            app.Segments.Verify(x => x.UpdateAsync(It.IsAny<Segment>()), Times.Never);
            app.Publisher.VerifyNoOtherCalls();
        }
        else if (segment) app.Segments.Verify(x => x.UpdateAsync(app.Segment), Times.Once);
        else app.Flags.Verify(x => x.UpdateAsync(app.Flag), Times.Once);
    }
}

public class FieldChangeTestApp : PermissionCheckTestApp
{
    public bool Foreign { get; init; }
    public Guid EnvironmentId { get; } = Guid.NewGuid();
    public FeatureFlag Flag { get; }
    public Segment Segment { get; }
    public Mock<IFeatureFlagService> Flags { get; } = new();
    public Mock<ISegmentService> Segments { get; } = new();
    public Mock<IResourceService> Resources { get; } = new();
    public Mock<IPublisher> Publisher { get; } = new();
    public FieldChangeTestApp()
    {
        Flag = new(EnvironmentId, "Original", "", "flag", false, VariationTypes.Boolean,
            [new() { Id = "off", Value = "false" }, new() { Id = "on", Value = "true" }],
            "off", "on", [], Guid.NewGuid()) { Id = Guid.NewGuid() };
        Segment = new(Guid.NewGuid(), EnvironmentId, "Original", "segment", SegmentType.EnvironmentSpecific,
            [], [], [], [], "") { Id = Guid.NewGuid() };
    }
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.ConfigureServices(services =>
        {
            var owner = Foreign ? Guid.NewGuid() : TestWorkspace.OrganizationId;
            // Identical relative RNs intentionally make the wildcard policy match in either organization.
            Resources.Setup(x => x.GetFlagRnAsync(EnvironmentId, "flag"))
                .ReturnsAsync(new ResourceRn("project/p:env/e:flag/flag", owner));
            Resources.Setup(x => x.GetSegmentRnAsync(EnvironmentId, Segment.Id))
                .ReturnsAsync(new ResourceRn("project/p:env/e:segment/segment", owner));
            Flags.Setup(x => x.GetAsync(EnvironmentId, "flag")).ReturnsAsync(Flag);
            Segments.Setup(x => x.GetAsync(Segment.Id)).ReturnsAsync(Segment);
            var members = new Mock<IMemberService>();
            members.Setup(x => x.GetPermissionsAsync(TestWorkspace.OrganizationId, TestUser.Id)).ReturnsAsync(
                [new PolicyStatement { ResourceType = ResourceTypes.All, Effect = EffectType.Allow, Actions = ["*"], Resources = ["*"] }]);
            services.Replace(ServiceDescriptor.Singleton(members.Object));
            services.Replace(ServiceDescriptor.Singleton(Flags.Object));
            services.Replace(ServiceDescriptor.Singleton(Segments.Object));
            services.Replace(ServiceDescriptor.Singleton(Resources.Object));
            services.Replace(ServiceDescriptor.Singleton(Publisher.Object));
            services.Replace(ServiceDescriptor.Scoped<ISender>(sp => sp.GetRequiredService<IMediator>()));
        });
    }
}
