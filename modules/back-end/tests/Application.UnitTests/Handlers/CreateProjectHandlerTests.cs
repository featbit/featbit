using Application.Bases.Exceptions;
using Application.Projects;
using Application.Services;
using Domain.Members;
using Domain.Policies;
using Domain.Projects;
using Domain.Resources;
using MediatR;
using Environment = Domain.Environments.Environment;

namespace Application.UnitTests.Handlers;

public class CreateProjectHandlerTests
{
    [Fact]
    public async Task Handle_GrantsCreatorAccessToCreatedProjectAndEnvironments()
    {
        var organizationId = Guid.NewGuid();
        var creatorId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var projectService = ProjectServiceReturning(projectId);
        var policyService = new Mock<IPolicyService>();
        Policy? createdPolicy = null;
        policyService
            .Setup(x => x.AddOneAsync(It.IsAny<Policy>()))
            .Callback<Policy>(policy =>
            {
                policy.Id = Guid.NewGuid();
                createdPolicy = policy;
            })
            .Returns(Task.CompletedTask);
        var memberService = new Mock<IMemberService>();
        MemberPolicy? assignment = null;
        memberService
            .Setup(x => x.AddPolicyAsync(It.IsAny<MemberPolicy>()))
            .Callback<MemberPolicy>(policy => assignment = policy)
            .Returns(Task.CompletedTask);
        var publisher = new Mock<IPublisher>();
        var sut = new CreateProjectHandler(
            projectService.Object,
            policyService.Object,
            memberService.Object,
            publisher.Object
        );

        var result = await sut.Handle(new CreateProject
        {
            OrganizationId = organizationId,
            CreatorId = creatorId,
            Name = "My project",
            Key = "my-project",
            CurrentUserPermissions = [Allow(Permissions.CreateProject, "project/*")]
        }, CancellationToken.None);

        Assert.Equal(projectId, result.Id);
        Assert.NotNull(createdPolicy);
        Assert.NotEqual(Guid.Empty, createdPolicy.Id);
        Assert.Equal(organizationId, createdPolicy.OrganizationId);
        Assert.Equal(ProjectCreatorAccess.PolicyKey(projectId), createdPolicy.Key);
        Assert.Equal(PolicyTypes.CustomerManaged, createdPolicy.Type);
        Assert.Contains(createdPolicy.Statements, statement =>
            statement.ResourceType == ResourceTypes.Project &&
            statement.Actions.SequenceEqual([Permissions.CanAccessProject]) &&
            statement.Resources.SequenceEqual(["project/my-project"]));
        Assert.Contains(createdPolicy.Statements, statement =>
            statement.ResourceType == ResourceTypes.Env &&
            statement.Actions.SequenceEqual([Permissions.CanAccessEnv]) &&
            statement.Resources.SequenceEqual(["project/my-project:env/*"]));
        var grantedPermissions = createdPolicy.Statements.ToArray();
        Assert.True(PolicyHelper.IsAllowed(
            grantedPermissions,
            "project/my-project",
            Permissions.CanAccessProject
        ));
        Assert.True(PolicyHelper.IsAllowed(
            grantedPermissions,
            "project/my-project:env/dev",
            Permissions.CanAccessEnv
        ));
        Assert.False(PolicyHelper.IsAllowed(
            grantedPermissions,
            "project/another-project",
            Permissions.CanAccessProject
        ));
        Assert.False(PolicyHelper.IsAllowed(
            grantedPermissions,
            "project/another-project:env/dev",
            Permissions.CanAccessEnv
        ));
        Assert.NotNull(assignment);
        Assert.Equal(organizationId, assignment.OrganizationId);
        Assert.Equal(creatorId, assignment.MemberId);
        Assert.Equal(createdPolicy.Id, assignment.PolicyId);
        publisher.Verify(x => x.Publish(
            It.Is<OnProjectAdded>(notification => notification.ProjectWithEnvs == result),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_DoesNotAssignMemberPolicyForServiceTokenRequest()
    {
        var projectService = ProjectServiceReturning(Guid.NewGuid());
        var policyService = new Mock<IPolicyService>();
        var memberService = new Mock<IMemberService>();
        var publisher = new Mock<IPublisher>();
        var sut = new CreateProjectHandler(
            projectService.Object,
            policyService.Object,
            memberService.Object,
            publisher.Object
        );

        await sut.Handle(new CreateProject
        {
            OrganizationId = Guid.NewGuid(),
            CreatorId = Guid.Empty,
            Name = "Automated project",
            Key = "automated-project",
            CurrentUserPermissions = [Allow(Permissions.CreateProject, "project/*")]
        }, CancellationToken.None);

        policyService.Verify(x => x.AddOneAsync(It.IsAny<Policy>()), Times.Never);
        memberService.Verify(x => x.AddPolicyAsync(It.IsAny<MemberPolicy>()), Times.Never);
    }

    [Fact]
    public async Task Handle_DoesNotCreateRedundantPolicyWhenCreatorAlreadyHasAccess()
    {
        var projectService = ProjectServiceReturning(Guid.NewGuid());
        var policyService = new Mock<IPolicyService>();
        var memberService = new Mock<IMemberService>();
        var publisher = new Mock<IPublisher>();
        var sut = new CreateProjectHandler(
            projectService.Object,
            policyService.Object,
            memberService.Object,
            publisher.Object
        );

        await sut.Handle(new CreateProject
        {
            OrganizationId = Guid.NewGuid(),
            CreatorId = Guid.NewGuid(),
            Name = "My project",
            Key = "my-project",
            CurrentUserPermissions =
            [
                Allow(Permissions.CanAccessProject, "project/*"),
                Allow(Permissions.CanAccessEnv, "project/*:env/*")
            ]
        }, CancellationToken.None);

        policyService.Verify(x => x.AddOneAsync(It.IsAny<Policy>()), Times.Never);
        memberService.Verify(x => x.AddPolicyAsync(It.IsAny<MemberPolicy>()), Times.Never);
    }

    [Fact]
    public async Task Handle_RejectsExplicitDenyBeforeCreatingProject()
    {
        var projectService = ProjectServiceReturning(Guid.NewGuid());
        var policyService = new Mock<IPolicyService>();
        var memberService = new Mock<IMemberService>();
        var publisher = new Mock<IPublisher>();
        var sut = new CreateProjectHandler(
            projectService.Object,
            policyService.Object,
            memberService.Object,
            publisher.Object
        );

        await Assert.ThrowsAsync<ForbiddenException>(() => sut.Handle(new CreateProject
        {
            OrganizationId = Guid.NewGuid(),
            CreatorId = Guid.NewGuid(),
            Name = "My project",
            Key = "my-project",
            CurrentUserPermissions =
            [
                Allow(Permissions.CreateProject, "project/*"),
                Deny(Permissions.CanAccessProject, "project/*")
            ]
        }, CancellationToken.None));

        projectService.Verify(x => x.AddWithEnvsAsync(
            It.IsAny<Project>(),
            It.IsAny<IEnumerable<string>>()), Times.Never);
    }

    [Fact]
    public async Task Handle_RemovesCreatedResourcesWhenPolicyAssignmentFails()
    {
        var projectId = Guid.NewGuid();
        var projectService = ProjectServiceReturning(projectId);
        projectService.Setup(x => x.DeleteAsync(projectId)).ReturnsAsync(true);
        var policyService = new Mock<IPolicyService>();
        Policy? createdPolicy = null;
        policyService
            .Setup(x => x.AddOneAsync(It.IsAny<Policy>()))
            .Callback<Policy>(policy =>
            {
                policy.Id = Guid.NewGuid();
                createdPolicy = policy;
            })
            .Returns(Task.CompletedTask);
        policyService.Setup(x => x.DeleteAsync(It.IsAny<Guid>())).Returns(Task.CompletedTask);
        var memberService = new Mock<IMemberService>();
        memberService
            .Setup(x => x.AddPolicyAsync(It.IsAny<MemberPolicy>()))
            .ThrowsAsync(new InvalidOperationException("assignment failed"));
        var publisher = new Mock<IPublisher>();
        var sut = new CreateProjectHandler(
            projectService.Object,
            policyService.Object,
            memberService.Object,
            publisher.Object
        );

        await Assert.ThrowsAsync<InvalidOperationException>(() => sut.Handle(new CreateProject
        {
            OrganizationId = Guid.NewGuid(),
            CreatorId = Guid.NewGuid(),
            Name = "My project",
            Key = "my-project",
            CurrentUserPermissions = [Allow(Permissions.CreateProject, "project/*")]
        }, CancellationToken.None));

        Assert.NotNull(createdPolicy);
        policyService.Verify(x => x.DeleteAsync(createdPolicy.Id), Times.Once);
        projectService.Verify(x => x.DeleteAsync(projectId), Times.Once);
        publisher.Verify(x => x.Publish(
            It.IsAny<OnProjectAdded>(),
            It.IsAny<CancellationToken>()), Times.Never);
    }

    private static Mock<IProjectService> ProjectServiceReturning(Guid projectId)
    {
        var service = new Mock<IProjectService>();
        service
            .Setup(x => x.HasKeyBeenUsedAsync(It.IsAny<Guid>(), It.IsAny<string>()))
            .ReturnsAsync(false);
        service
            .Setup(x => x.AddWithEnvsAsync(It.IsAny<Project>(), It.IsAny<IEnumerable<string>>()))
            .ReturnsAsync((Project project, IEnumerable<string> environmentNames) =>
            {
                project.Id = projectId;
                return new ProjectWithEnvs
                {
                    Id = projectId,
                    Name = project.Name,
                    Key = project.Key,
                    Environments = environmentNames.Select(name => new Environment(
                        projectId,
                        name,
                        name.ToLowerInvariant()
                    )).ToArray()
                };
            });

        return service;
    }

    private static PolicyStatement Allow(string action, string resource) =>
        Statement(EffectType.Allow, action, resource);

    private static PolicyStatement Deny(string action, string resource) =>
        Statement(EffectType.Deny, action, resource);

    private static PolicyStatement Statement(string effect, string action, string resource)
    {
        return new PolicyStatement
        {
            ResourceType = ResourceTypes.Project,
            Effect = effect,
            Actions = [action],
            Resources = [resource]
        };
    }
}
