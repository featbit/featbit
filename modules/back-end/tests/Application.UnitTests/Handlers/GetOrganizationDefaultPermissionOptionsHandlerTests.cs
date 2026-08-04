using System.Linq.Expressions;
using Application.Bases.Exceptions;
using Application.Organizations;
using Application.Services;
using Domain.Groups;
using Domain.Organizations;
using Domain.Policies;

namespace Application.UnitTests.Handlers;

public class GetOrganizationDefaultPermissionOptionsHandlerTests
{
    [Fact]
    public async Task Handle_Member_ReturnsOnlyConfiguredPolicyAndGroupNames()
    {
        var organizationId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var policy = new Policy(organizationId, "Developer", "developer", "")
        {
            Id = Guid.NewGuid(),
            Type = PolicyTypes.SysManaged,
            OrganizationId = null
        };
        var group = new Group(organizationId, "Release managers", "")
        {
            Id = Guid.NewGuid()
        };
        var otherOrganizationPolicy = new Policy(Guid.NewGuid(), "Other policy", "other-policy", "")
        {
            Id = Guid.NewGuid()
        };
        var otherOrganizationGroup = new Group(Guid.NewGuid(), "Other group", "")
        {
            Id = Guid.NewGuid()
        };
        var organization = new Organization(Guid.NewGuid(), "Organization", "organization")
        {
            Id = organizationId,
            DefaultPermissions = new OrganizationPermissions
            {
                PolicyIds = [policy.Id, otherOrganizationPolicy.Id],
                GroupIds = [group.Id, otherOrganizationGroup.Id]
            }
        };
        var organizationService = new Mock<IOrganizationService>();
        organizationService.Setup(x => x.ContainsUserAsync(organizationId, userId)).ReturnsAsync(true);
        organizationService.Setup(x => x.GetAsync(organizationId)).ReturnsAsync(organization);
        var policyService = new Mock<IPolicyService>();
        policyService
            .Setup(x => x.FindManyAsync(It.IsAny<Expression<Func<Policy, bool>>>()))
            .ReturnsAsync((Expression<Func<Policy, bool>> predicate) =>
                new[] { policy, otherOrganizationPolicy }
                    .Where(predicate.Compile())
                    .ToArray());
        var groupService = new Mock<IGroupService>();
        groupService
            .Setup(x => x.FindManyAsync(It.IsAny<Expression<Func<Group, bool>>>()))
            .ReturnsAsync((Expression<Func<Group, bool>> predicate) =>
                new[] { group, otherOrganizationGroup }
                    .Where(predicate.Compile())
                    .ToArray());
        var sut = new GetOrganizationDefaultPermissionOptionsHandler(
            organizationService.Object,
            policyService.Object,
            groupService.Object);

        var result = await sut.Handle(new GetOrganizationDefaultPermissionOptions
        {
            OrganizationId = organizationId,
            UserId = userId
        }, CancellationToken.None);

        var policyOption = Assert.Single(result.Policies);
        Assert.Equal(policy.Id.ToString(), policyOption.Id);
        Assert.Equal("Developer", policyOption.Name);
        Assert.Equal(PolicyTypes.SysManaged, policyOption.Type);
        var groupOption = Assert.Single(result.Groups);
        Assert.Equal(group.Id.ToString(), groupOption.Id);
        Assert.Equal("Release managers", groupOption.Name);
    }

    [Fact]
    public async Task Handle_NonMember_ThrowsForbiddenWithoutReadingOrganization()
    {
        var organizationId = Guid.NewGuid();
        var userId = Guid.NewGuid();
        var organizationService = new Mock<IOrganizationService>();
        organizationService.Setup(x => x.ContainsUserAsync(organizationId, userId)).ReturnsAsync(false);
        var policyService = new Mock<IPolicyService>();
        var groupService = new Mock<IGroupService>();
        var sut = new GetOrganizationDefaultPermissionOptionsHandler(
            organizationService.Object,
            policyService.Object,
            groupService.Object);

        await Assert.ThrowsAsync<ForbiddenException>(() => sut.Handle(
            new GetOrganizationDefaultPermissionOptions
            {
                OrganizationId = organizationId,
                UserId = userId
            },
            CancellationToken.None));

        organizationService.Verify(x => x.GetAsync(It.IsAny<Guid>()), Times.Never);
        policyService.Verify(
            x => x.FindManyAsync(It.IsAny<Expression<Func<Policy, bool>>>()),
            Times.Never);
        groupService.Verify(
            x => x.FindManyAsync(It.IsAny<Expression<Func<Group, bool>>>()),
            Times.Never);
    }
}
