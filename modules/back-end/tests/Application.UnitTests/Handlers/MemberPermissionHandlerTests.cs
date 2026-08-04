using Application.Members;
using Application.Services;
using Domain.Policies;
using Domain.Resources;

namespace Application.UnitTests.Handlers;

public class MemberPermissionHandlerTests
{
    [Fact]
    public void Map_MergesSourcesByPolicyIdWithoutDroppingSameNamePolicies()
    {
        var directPolicy = PolicyWithStatement(
            "Shared name",
            EffectType.Allow,
            [Permissions.DeleteEnv],
            ["project/prod:env/dev"]);
        var otherPolicyWithSameName = PolicyWithStatement(
            "Shared name",
            EffectType.Deny,
            [Permissions.DeleteEnv],
            ["project/prod:env/prod"]);
        var groupId = Guid.NewGuid();

        var permissions = MemberPermissionMapper.Map([
            DirectAssignment(directPolicy),
            GroupAssignment(directPolicy, groupId, "Developers"),
            DirectAssignment(otherPolicyWithSameName)
        ]);

        Assert.Equal(2, permissions.Count);
        var directPermission = Assert.Single(permissions, x => x.PolicyId == directPolicy.Id);
        Assert.Collection(
            directPermission.Sources,
            source => Assert.Equal(MemberPermissionAssignmentTypes.Direct, source.AssignmentType),
            source =>
            {
                Assert.Equal(MemberPermissionAssignmentTypes.Group, source.AssignmentType);
                Assert.Equal(groupId, source.GroupId);
                Assert.Equal("Developers", source.GroupName);
            });
    }

    [Fact]
    public async Task Evaluate_ExplicitDenyOverridesMatchingAllowAndReturnsBothSources()
    {
        const string resource = "project/prod:env/dev";
        var allowPolicy = PolicyWithStatement(
            "Environment manager",
            EffectType.Allow,
            ["*"],
            ["project/prod:env/*"]);
        var denyPolicy = PolicyWithStatement(
            "Restricted production access",
            EffectType.Deny,
            [Permissions.DeleteEnv],
            [resource]);
        var assignments = new MemberPermissionPolicyAssignment[]
        {
            GroupAssignment(allowPolicy, Guid.NewGuid(), "Developers"),
            DirectAssignment(denyPolicy)
        };
        var service = new Mock<IMemberService>();
        service.Setup(x => x.GetPermissionAssignmentsAsync(It.IsAny<Guid>(), It.IsAny<Guid>()))
            .ReturnsAsync(assignments);
        var handler = new EvaluateMemberPermissionHandler(service.Object);

        var result = await handler.Handle(new EvaluateMemberPermission
        {
            OrganizationId = Guid.NewGuid(),
            MemberId = Guid.NewGuid(),
            Resource = resource,
            Action = Permissions.DeleteEnv
        }, CancellationToken.None);

        Assert.False(result.Granted);
        Assert.Equal(MemberPermissionDecisions.ExplicitDeny, result.Decision);
        Assert.Equal(resource, result.Resource);
        Assert.Equal(Permissions.DeleteEnv, result.Action);
        Assert.Equal(2, result.MatchedRules.Count);
        Assert.Contains(result.MatchedRules, x => x.PolicyName == "Environment manager");
        Assert.Contains(result.MatchedRules, x => x.PolicyName == "Restricted production access");
    }

    [Fact]
    public async Task Evaluate_MatchingAllow_ReturnsAllowed()
    {
        var policy = PolicyWithStatement(
            "Environment viewer",
            EffectType.Allow,
            [Permissions.CanAccessEnv],
            ["project/prod:env/*"]);
        var service = new Mock<IMemberService>();
        service.Setup(x => x.GetPermissionAssignmentsAsync(It.IsAny<Guid>(), It.IsAny<Guid>()))
            .ReturnsAsync([DirectAssignment(policy)]);
        var handler = new EvaluateMemberPermissionHandler(service.Object);

        var result = await handler.Handle(new EvaluateMemberPermission
        {
            OrganizationId = Guid.NewGuid(),
            MemberId = Guid.NewGuid(),
            Resource = "project/prod:env/dev",
            Action = Permissions.CanAccessEnv
        }, CancellationToken.None);

        Assert.True(result.Granted);
        Assert.Equal(MemberPermissionDecisions.Allowed, result.Decision);
        Assert.Single(result.MatchedRules);
    }

    [Fact]
    public async Task Evaluate_NoMatchingRule_ReturnsDeniedWithNoMatches()
    {
        var policy = PolicyWithStatement(
            "Environment viewer",
            EffectType.Allow,
            [Permissions.CanAccessEnv],
            ["project/prod:env/dev"]);
        var service = new Mock<IMemberService>();
        service.Setup(x => x.GetPermissionAssignmentsAsync(It.IsAny<Guid>(), It.IsAny<Guid>()))
            .ReturnsAsync([DirectAssignment(policy)]);
        var handler = new EvaluateMemberPermissionHandler(service.Object);

        var result = await handler.Handle(new EvaluateMemberPermission
        {
            OrganizationId = Guid.NewGuid(),
            MemberId = Guid.NewGuid(),
            Resource = "project/prod:env/prod",
            Action = Permissions.DeleteEnv
        }, CancellationToken.None);

        Assert.False(result.Granted);
        Assert.Equal(MemberPermissionDecisions.NoMatchingRule, result.Decision);
        Assert.Empty(result.MatchedRules);
    }

    [Theory]
    [InlineData("", "DeleteEnv")]
    [InlineData("project/prod:env/dev", "")]
    public void Validate_MissingEvaluationInput_IsInvalid(string resource, string action)
    {
        var validator = new EvaluateMemberPermissionValidator();

        var result = validator.Validate(new EvaluateMemberPermission
        {
            Resource = resource,
            Action = action
        });

        Assert.False(result.IsValid);
    }

    private static Policy PolicyWithStatement(
        string name,
        string effect,
        ICollection<string> actions,
        ICollection<string> resources)
    {
        var policy = new Policy(Guid.NewGuid(), name, Guid.NewGuid().ToString(), string.Empty)
        {
            Id = Guid.NewGuid()
        };
        policy.UpdateStatements([
            new PolicyStatement
            {
                Id = Guid.NewGuid().ToString(),
                ResourceType = ResourceTypes.Env,
                Effect = effect,
                Actions = actions,
                Resources = resources
            }
        ]);

        return policy;
    }

    private static MemberPermissionPolicyAssignment DirectAssignment(Policy policy) => new()
    {
        Policy = policy,
        Source = new MemberPermissionSourceVm
        {
            AssignmentType = MemberPermissionAssignmentTypes.Direct
        }
    };

    private static MemberPermissionPolicyAssignment GroupAssignment(
        Policy policy,
        Guid groupId,
        string groupName) => new()
    {
        Policy = policy,
        Source = new MemberPermissionSourceVm
        {
            AssignmentType = MemberPermissionAssignmentTypes.Group,
            GroupId = groupId,
            GroupName = groupName
        }
    };
}
