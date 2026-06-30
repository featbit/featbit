using Application.Members;
using Application.Services;
using Domain.Organizations;
using Domain.Workspaces;

namespace Application.UnitTests.Handlers;

public class RemoveFromWorkspaceHandlerTests
{
    [Fact]
    public async Task Handle_DeletesMembershipsAcrossAllOrgsAndRemovesFromWorkspace()
    {
        var workspaceId = Guid.NewGuid();
        var memberId = Guid.NewGuid();

        var orgs = new[]
        {
            new Organization(workspaceId, "org-a", "a") { Id = Guid.NewGuid() },
            new Organization(workspaceId, "org-b", "b") { Id = Guid.NewGuid() },
            new Organization(workspaceId, "org-c", "c") { Id = Guid.NewGuid() }
        };

        var workspaceSvc = new Mock<IWorkspaceService>();
        var userSvc = new Mock<IUserService>();
        var orgSvc = new Mock<IOrganizationService>();
        orgSvc.Setup(x => x.GetUserOrganizationsAsync(workspaceId, memberId))
            .ReturnsAsync(orgs);
        var memberSvc = new Mock<IMemberService>();

        // user is still in another workspace → should NOT be deleted
        userSvc.Setup(x => x.GetWorkspacesAsync(memberId))
            .ReturnsAsync(new[] { new Workspace { Name = "other", Key = "other" } });

        var sut = new RemoveFromWorkspaceHandler(
            workspaceSvc.Object, userSvc.Object, orgSvc.Object, memberSvc.Object);

        var result = await sut.Handle(
            new RemoveFromWorkspace { WorkspaceId = workspaceId, MemberId = memberId },
            CancellationToken.None);

        Assert.True(result);
        foreach (var org in orgs)
        {
            memberSvc.Verify(x => x.DeleteAsync(org.Id, memberId), Times.Once);
        }
        workspaceSvc.Verify(x => x.RemoveUserAsync(workspaceId, memberId), Times.Once);
        userSvc.Verify(x => x.DeleteOneAsync(It.IsAny<Guid>()), Times.Never);
    }

    [Fact]
    public async Task Handle_UserHasNoOtherWorkspaces_DeletesUserAccount()
    {
        var workspaceId = Guid.NewGuid();
        var memberId = Guid.NewGuid();

        var workspaceSvc = new Mock<IWorkspaceService>();
        var orgSvc = new Mock<IOrganizationService>();
        orgSvc.Setup(x => x.GetUserOrganizationsAsync(workspaceId, memberId))
            .ReturnsAsync(Array.Empty<Organization>());
        var memberSvc = new Mock<IMemberService>();
        var userSvc = new Mock<IUserService>();
        userSvc.Setup(x => x.GetWorkspacesAsync(memberId))
            .ReturnsAsync(Array.Empty<Workspace>());

        var sut = new RemoveFromWorkspaceHandler(
            workspaceSvc.Object, userSvc.Object, orgSvc.Object, memberSvc.Object);

        var result = await sut.Handle(
            new RemoveFromWorkspace { WorkspaceId = workspaceId, MemberId = memberId },
            CancellationToken.None);

        Assert.True(result);
        workspaceSvc.Verify(x => x.RemoveUserAsync(workspaceId, memberId), Times.Once);
        userSvc.Verify(x => x.DeleteOneAsync(memberId), Times.Once);
        memberSvc.Verify(x => x.DeleteAsync(It.IsAny<Guid>(), It.IsAny<Guid>()), Times.Never);
    }

    [Fact]
    public async Task Handle_NoOrganizations_StillRemovesUserFromWorkspace()
    {
        var workspaceId = Guid.NewGuid();
        var memberId = Guid.NewGuid();

        var workspaceSvc = new Mock<IWorkspaceService>();
        var orgSvc = new Mock<IOrganizationService>();
        orgSvc.Setup(x => x.GetUserOrganizationsAsync(workspaceId, memberId))
            .ReturnsAsync(Array.Empty<Organization>());
        var memberSvc = new Mock<IMemberService>(MockBehavior.Strict);
        var userSvc = new Mock<IUserService>();
        userSvc.Setup(x => x.GetWorkspacesAsync(memberId))
            .ReturnsAsync(new[] { new Workspace { Name = "w", Key = "w" } });

        var sut = new RemoveFromWorkspaceHandler(
            workspaceSvc.Object, userSvc.Object, orgSvc.Object, memberSvc.Object);

        var result = await sut.Handle(
            new RemoveFromWorkspace { WorkspaceId = workspaceId, MemberId = memberId },
            CancellationToken.None);

        Assert.True(result);
        workspaceSvc.Verify(x => x.RemoveUserAsync(workspaceId, memberId), Times.Once);
        userSvc.Verify(x => x.DeleteOneAsync(It.IsAny<Guid>()), Times.Never);
    }
}
