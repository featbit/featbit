using Application.Bases.Exceptions;
using Application.Services;
using Application.Segments;
using Domain.AuditLogs;
using Domain.Policies;
using Domain.Resources;
using Domain.Segments;

namespace Application.UnitTests.Segments;

public class SegmentPermissionGuardTests
{
    private static Segment NewSegment() => new(Guid.NewGuid(), Guid.NewGuid(), "before", "segment",
        SegmentType.EnvironmentSpecific, [], [], [], [], "") { Id = Guid.NewGuid() };

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
            ownership == "blank-rn" ? " " : "project/p:env/e:segment/segment",
            ownership == "missing-org" ? null : ownership == "foreign" ? Guid.NewGuid() : org);
        targetResolver.Setup(x => x.ResolveSegmentAsync(It.IsAny<Guid>(), It.IsAny<Guid>())).ReturnsAsync(resource);
        var guard = new SegmentPermissionGuard(targetResolver.Object);
        var seg = NewSegment();
        var change = new DataChange(seg);
        if (changed) seg.Name = "after";
        change.To(seg);
        PolicyStatement[] permissions = changed
            ? [new() { ResourceType = ResourceTypes.All, Effect = EffectType.Allow, Actions = ["*"], Resources = ["*"] }]
            : [];
        var requestOrg = ownership == "empty-request-org" ? Guid.Empty : org;
        Func<Task> act = () => changed
            ? guard.EnsureChangeAllowedAsync(requestOrg, seg.EnvId, seg.Id, change, permissions)
            : guard.EnsureInOrganizationAsync(requestOrg, seg.EnvId, seg.Id);
        if (ownership == "own") await act();
        else await Assert.ThrowsAsync<ForbiddenException>(act);
        if (ownership == "empty-request-org") targetResolver.VerifyNoOtherCalls();
        else targetResolver.Verify(x => x.ResolveSegmentAsync(seg.EnvId, seg.Id), Times.Once);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task OwnOrganizationStillRequiresEachChangedFieldPermission(bool explicitDeny)
    {
        var org = Guid.NewGuid();
        var targetResolver = new Mock<IPermissionTargetResolver>();
        targetResolver.Setup(x => x.ResolveSegmentAsync(It.IsAny<Guid>(), It.IsAny<Guid>())).ReturnsAsync(new PermissionTarget("project/p:env/e:segment/segment", org));
        var guard = new SegmentPermissionGuard(targetResolver.Object);
        var seg = NewSegment();
        var change = new DataChange(seg);
        seg.Name = "after";
        change.To(seg);
        PolicyStatement[] policies = explicitDeny
            ? [new() { ResourceType = ResourceTypes.All, Effect = EffectType.Allow },
                new() { ResourceType = ResourceTypes.Segment,
                    Effect = EffectType.Deny, Actions = [Permissions.UpdateSegmentName], Resources = ["*"] }]
            : [];
        await Assert.ThrowsAsync<ForbiddenException>(() => guard.EnsureChangeAllowedAsync(org, seg.EnvId, seg.Id, change, policies));
    }
}
