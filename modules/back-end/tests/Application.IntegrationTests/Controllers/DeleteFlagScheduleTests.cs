using System.Linq.Expressions;
using System.Net;
using Application.Services;
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.FlagDrafts;
using Domain.FlagSchedules;
using Domain.Policies;
using Domain.Resources;
using MediatR;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Moq;

namespace Application.IntegrationTests.Controllers;

[Trait("Category", "Host")]
[Collection(nameof(TestApp))]
public class DeleteFlagScheduleTests
{
    [Theory]
    [InlineData("schedule-missing")]
    [InlineData("schedule-org")]
    [InlineData("schedule-env")]
    [InlineData("flag-missing")]
    [InlineData("flag-env")]
    [InlineData("draft-missing")]
    [InlineData("draft-env")]
    [InlineData("draft-flag")]
    [InlineData("resource-missing")]
    [InlineData("resource-org")]
    [InlineData("resource-owner-missing")]
    [InlineData("resource-blank")]
    [InlineData("no-permission")]
    [InlineData("other-flag")]
    [InlineData("other-tag")]
    [InlineData("deny")]
    [InlineData("partial-permission")]
    [InlineData("noop-foreign")]
    public async Task RejectsInvalidOwnershipOrPermissionWithoutDeleting(string scenario)
    {
        await using var app = new DeleteFlagScheduleTestApp { Scenario = scenario };
        var client = await app.CreateAuthenticatedClientAsync();
        var response = await client.DeleteAsync($"/api/v1/envs/{app.EnvId}/feature-flags/schedules/{app.ScheduleId}");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        app.Schedules.Verify(x => x.DeleteAsync(It.IsAny<Guid>()), Times.Never);
        app.Schedules.Verify(x => x.DeleteOneAsync(It.IsAny<Guid>()), Times.Never);
    }

    [Theory]
    [InlineData("key")]
    [InlineData("tag")]
    [InlineData("all-permissions")]
    [InlineData("noop")]
    public async Task DeletesOnlyAuthorizedSchedule(string scenario)
    {
        await using var app = new DeleteFlagScheduleTestApp { Scenario = scenario };
        var client = await app.CreateAuthenticatedClientAsync();
        var response = await client.DeleteAsync($"/api/v1/envs/{app.EnvId}/feature-flags/schedules/{app.ScheduleId}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        app.Resources.Verify(x => x.GetFlagRnAsync(app.EnvId, "flag"), Times.Once);
        app.Schedules.Verify(x => x.DeleteAsync(app.ScheduleId), Times.Once);
        app.Schedules.Verify(x => x.DeleteAsync(It.Is<Guid>(id => id != app.ScheduleId)), Times.Never);
    }

    [Fact]
    public async Task LicenseRequirementStillPreventsDeletion()
    {
        await using var app = new DeleteFlagScheduleTestApp { Scenario = "no-license" };
        var client = await app.CreateAuthenticatedClientAsync();
        var response = await client.DeleteAsync($"/api/v1/envs/{app.EnvId}/feature-flags/schedules/{app.ScheduleId}");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        app.Schedules.VerifyNoOtherCalls();
    }
}

public class DeleteFlagScheduleTestApp : PermissionCheckTestApp
{
    public string Scenario { get; init; } = "key";
    public Guid EnvId { get; } = Guid.NewGuid();
    public Guid ScheduleId { get; } = Guid.NewGuid();
    public Mock<IFlagScheduleService> Schedules { get; } = new();
    public Mock<IResourceService> Resources { get; } = new();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.ConfigureServices(services =>
        {
            var flag = new FeatureFlag(EnvId, "Flag", "", "flag", false, VariationTypes.Boolean,
                [new() { Id = "off", Value = "false" }, new() { Id = "on", Value = "true" }],
                "off", "on", ["team"], Guid.NewGuid()) { Id = Guid.NewGuid() };
            var change = new DataChange(flag);
            if (Scenario is not ("noop" or "noop-foreign")) flag.DisabledVariationId = "on";
            if (Scenario is "partial-permission" or "all-permissions") flag.IsEnabled = true;
            change.To(flag);
            var draft = new FlagDraft(EnvId, flag.Id, change, Guid.NewGuid()) { Id = Guid.NewGuid() };
            var schedule = new FlagSchedule(TestWorkspace.OrganizationId, EnvId, draft.Id, flag.Id,
                FlagScheduleStatus.PendingExecution, "schedule", DateTime.UtcNow.AddDays(1), Guid.NewGuid(), null)
                { Id = ScheduleId };
            if (Scenario == "schedule-org") schedule.OrgId = Guid.NewGuid();
            if (Scenario == "schedule-env") schedule.EnvId = Guid.NewGuid();
            if (Scenario == "flag-env") flag.EnvId = Guid.NewGuid();
            if (Scenario == "draft-env") draft.EnvId = Guid.NewGuid();
            if (Scenario == "draft-flag") draft.FlagId = Guid.NewGuid();
            Schedules.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<FlagSchedule, bool>>>()))
                .ReturnsAsync((Expression<Func<FlagSchedule, bool>> predicate) =>
                    Scenario != "schedule-missing" && predicate.Compile()(schedule) ? schedule : null);
            var flags = new Mock<IFeatureFlagService>();
            flags.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<FeatureFlag, bool>>>()))
                .ReturnsAsync((Expression<Func<FeatureFlag, bool>> predicate) =>
                    Scenario != "flag-missing" && predicate.Compile()(flag) ? flag : null);
            var drafts = new Mock<IFlagDraftService>();
            drafts.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<FlagDraft, bool>>>()))
                .ReturnsAsync((Expression<Func<FlagDraft, bool>> predicate) =>
                    Scenario != "draft-missing" && predicate.Compile()(draft) ? draft : null);
            ResourceRn? resource = Scenario switch
            {
                "resource-missing" => null,
                "resource-org" or "noop-foreign" => new("project/p:env/e:flag/flag;team", Guid.NewGuid()),
                "resource-owner-missing" => new("project/p:env/e:flag/flag;team", null),
                "resource-blank" => new("", TestWorkspace.OrganizationId),
                _ => new("project/p:env/e:flag/flag;team", TestWorkspace.OrganizationId)
            };
            Resources.Setup(x => x.GetFlagRnAsync(EnvId, "flag")).ReturnsAsync(resource);
            var statements = new List<PolicyStatement>();
            var pattern = Scenario switch
            {
                "tag" => "project/p:env/e:flag/*;team",
                "other-tag" => "project/p:env/e:flag/*;other",
                "other-flag" => "project/p:env/e:flag/other",
                _ => "project/p:env/e:flag/flag"
            };
            if (Scenario is not ("no-permission" or "noop" or "noop-foreign"))
                statements.Add(new() { ResourceType = ResourceTypes.FeatureFlag, Effect = EffectType.Allow,
                    Resources = [pattern], Actions = Scenario == "all-permissions"
                        ? [Permissions.UpdateFlagOffVariation, Permissions.ToggleFlag] : [Permissions.UpdateFlagOffVariation] });
            if (Scenario == "deny")
                statements.Add(new() { ResourceType = ResourceTypes.FeatureFlag, Effect = EffectType.Deny,
                    Resources = ["project/p:env/e:flag/*;team"], Actions = [Permissions.UpdateFlagOffVariation] });
            var members = new Mock<IMemberService>();
            members.Setup(x => x.GetPermissionsAsync(TestWorkspace.OrganizationId, TestUser.Id)).ReturnsAsync(statements.ToArray());
            var license = new Mock<ILicenseService>();
            license.Setup(x => x.IsFeatureGrantedAsync(It.IsAny<Guid>(), It.IsAny<string>())).ReturnsAsync(Scenario != "no-license");
            services.Replace(ServiceDescriptor.Singleton(Schedules.Object));
            services.Replace(ServiceDescriptor.Singleton(Resources.Object));
            services.Replace(ServiceDescriptor.Singleton(flags.Object));
            services.Replace(ServiceDescriptor.Singleton(drafts.Object));
            services.Replace(ServiceDescriptor.Singleton(members.Object));
            services.Replace(ServiceDescriptor.Singleton(license.Object));
            services.Replace(ServiceDescriptor.Scoped<ISender>(sp => sp.GetRequiredService<IMediator>()));
        });
    }
}
