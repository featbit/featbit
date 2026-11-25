using Application.Bases.Exceptions;
using Application.Policies;
using Application.Services;
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.Policies;
using Domain.Resources;

namespace Application.UnitTests.Policies;

public class PermissionGuardTests
{
    private static FeatureFlag NewFlag() => new(Guid.NewGuid(), "before", "", "flag", false, VariationTypes.Boolean,
        [new() { Id = "off", Value = "false" }, new() { Id = "on", Value = "true" }],
        "off", "on", [], Guid.NewGuid()) { Id = Guid.NewGuid() };

    public static IEnumerable<object[]> OwnershipCases =>
        from changed in new[] { false, true }
        from ownership in new[] { "own", "foreign", "missing-org", "missing-resource", "blank-rn", "empty-request-org" }
        select new object[] { changed, ownership };

    [Theory]
    [MemberData(nameof(OwnershipCases))]
    public async Task OwnershipIsValidatedRegardlessOfChanges(bool changed, string ownership)
    {
        var org = Guid.NewGuid();
        var targetResolver = new Mock<IPermissionTargetResolver>();
        PermissionTarget resource = ownership == "missing-resource" ? null! : new(
            ownership == "blank-rn" ? " " : "project/p:env/e:flag/flag",
            ownership == "missing-org" ? null : ownership == "foreign" ? Guid.NewGuid() : org);
        targetResolver.Setup(x => x.ResolveFlagAsync(It.IsAny<Guid>(), It.IsAny<string>())).ReturnsAsync(resource);
        var guard = new PermissionGuard(targetResolver.Object);
        var flag = NewFlag();
        var change = new DataChange(flag);
        if (changed) flag.Name = "after";
        change.To(flag);
        PolicyStatement[] permissions = changed
            ? [new() { ResourceType = ResourceTypes.All, Effect = EffectType.Allow, Actions = ["*"], Resources = ["*"] }]
            : [];
        var requestOrg = ownership == "empty-request-org" ? Guid.Empty : org;
        Func<Task> act = () => changed
            ? guard.EnsureFlagChangeAllowedAsync(requestOrg, flag, change, permissions)
            : guard.EnsureFlagOwnershipAsync(requestOrg, flag);
        if (ownership == "own") await act();
        else await Assert.ThrowsAsync<ForbiddenException>(act);
        if (ownership == "empty-request-org") targetResolver.VerifyNoOtherCalls();
        else targetResolver.Verify(x => x.ResolveFlagAsync(flag.EnvId, flag.Key), Times.Once);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task OwnOrganizationStillRequiresEachChangedFieldPermission(bool explicitDeny)
    {
        var org = Guid.NewGuid();
        var targetResolver = new Mock<IPermissionTargetResolver>();
        targetResolver.Setup(x => x.ResolveFlagAsync(It.IsAny<Guid>(), It.IsAny<string>())).ReturnsAsync(new PermissionTarget("project/p:env/e:flag/flag", org));
        var guard = new PermissionGuard(targetResolver.Object);
        var flag = NewFlag();
        var change = new DataChange(flag);
        flag.Name = "after";
        change.To(flag);
        PolicyStatement[] policies = explicitDeny
            ? [new() { ResourceType = ResourceTypes.All, Effect = EffectType.Allow },
                new() { ResourceType = ResourceTypes.FeatureFlag,
                    Effect = EffectType.Deny, Actions = [Permissions.UpdateFlagName], Resources = ["*"] }]
            : [];
        await Assert.ThrowsAsync<ForbiddenException>(() => guard.EnsureFlagChangeAllowedAsync(org, flag, change, policies));
    }
}
