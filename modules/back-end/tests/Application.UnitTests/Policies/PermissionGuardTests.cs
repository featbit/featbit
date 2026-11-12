using Application.Bases.Exceptions;
using Application.Policies;
using Application.Services;
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.Policies;
using Domain.Resources;
using Domain.Segments;

namespace Application.UnitTests.Policies;

public class PermissionGuardTests
{
    private static FeatureFlag NewFlag() => new(Guid.NewGuid(), "before", "", "flag", false, VariationTypes.Boolean,
        [new() { Id = "off", Value = "false" }, new() { Id = "on", Value = "true" }],
        "off", "on", [], Guid.NewGuid()) { Id = Guid.NewGuid() };

    private static Segment NewSegment() => new(Guid.NewGuid(), Guid.NewGuid(), "before", "segment",
        SegmentType.EnvironmentSpecific, [], [], [], [], "") { Id = Guid.NewGuid() };

    public static IEnumerable<object[]> OwnershipCases =>
        from segment in new[] { false, true }
        from changed in new[] { false, true }
        from ownership in new[] { "own", "foreign", "missing-org", "missing-resource", "blank-rn", "empty-request-org" }
        select new object[] { segment, changed, ownership };

    [Theory]
    [MemberData(nameof(OwnershipCases))]
    public async Task OwnershipIsValidatedRegardlessOfChanges(bool segment, bool changed, string ownership)
    {
        var org = Guid.NewGuid();
        var resources = new Mock<IResourceService>();
        ResourceRn resource = ownership == "missing-resource" ? null! : new(
            ownership == "blank-rn" ? " " : "project/p:env/e:flag/flag",
            ownership == "missing-org" ? null : ownership == "foreign" ? Guid.NewGuid() : org);
        resources.Setup(x => x.GetFlagRnAsync(It.IsAny<Guid>(), It.IsAny<string>())).ReturnsAsync(resource);
        resources.Setup(x => x.GetSegmentRnAsync(It.IsAny<Guid>(), It.IsAny<Guid>())).ReturnsAsync(resource);
        var guard = new PermissionGuard(resources.Object);
        var flag = NewFlag();
        var seg = NewSegment();
        var change = new DataChange(segment ? (object)seg : flag);
        if (changed) { flag.Name = "after"; seg.Name = "after"; }
        change.To(segment ? (object)seg : flag);
        PolicyStatement[] permissions = changed
            ? [new() { ResourceType = ResourceTypes.All, Effect = EffectType.Allow, Actions = ["*"], Resources = ["*"] }]
            : [];
        var requestOrg = ownership == "empty-request-org" ? Guid.Empty : org;
        Func<Task> act = () => segment
            ? guard.EnsureSegmentChangeAllowedAsync(requestOrg, seg, change, permissions)
            : guard.EnsureFlagChangeAllowedAsync(requestOrg, flag, change, permissions);
        if (ownership == "own") await act();
        else await Assert.ThrowsAsync<ForbiddenException>(act);
        if (ownership == "empty-request-org") resources.VerifyNoOtherCalls();
        else if (segment) resources.Verify(x => x.GetSegmentRnAsync(seg.EnvId, seg.Id), Times.Once);
        else resources.Verify(x => x.GetFlagRnAsync(flag.EnvId, flag.Key), Times.Once);
    }

    [Theory]
    [InlineData(false, false)]
    [InlineData(false, true)]
    [InlineData(true, false)]
    [InlineData(true, true)]
    public async Task OwnOrganizationStillRequiresEachChangedFieldPermission(bool segment, bool explicitDeny)
    {
        var org = Guid.NewGuid();
        var resources = new Mock<IResourceService>();
        resources.Setup(x => x.GetFlagRnAsync(It.IsAny<Guid>(), It.IsAny<string>())).ReturnsAsync(new ResourceRn("project/p:env/e:flag/flag", org));
        resources.Setup(x => x.GetSegmentRnAsync(It.IsAny<Guid>(), It.IsAny<Guid>())).ReturnsAsync(new ResourceRn("project/p:env/e:segment/segment", org));
        var guard = new PermissionGuard(resources.Object);
        var flag = NewFlag();
        var seg = NewSegment();
        var change = new DataChange(segment ? (object)seg : flag);
        flag.Name = "after"; seg.Name = "after";
        change.To(segment ? (object)seg : flag);
        PolicyStatement[] policies = explicitDeny
            ? [new() { ResourceType = ResourceTypes.All, Effect = EffectType.Allow },
                new() { ResourceType = segment ? ResourceTypes.Segment : ResourceTypes.FeatureFlag,
                    Effect = EffectType.Deny, Actions = [segment ? Permissions.UpdateSegmentName : Permissions.UpdateFlagName], Resources = ["*"] }]
            : [];
        await Assert.ThrowsAsync<ForbiddenException>(() => segment
            ? guard.EnsureSegmentChangeAllowedAsync(org, seg, change, policies)
            : guard.EnsureFlagChangeAllowedAsync(org, flag, change, policies));
    }
}
