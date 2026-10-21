using Api;
using Api.Controllers;
using Application.FeatureFlags;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.DependencyInjection;

namespace Api.UnitTests.Controllers;

public class AuditOwnershipControllerTests
{
    [Fact]
    public async Task DeleteFlag_ForwardsActionOwnership()
    {
        var sender = new Mock<ISender>();
        var workspaceId = Guid.NewGuid();
        var orgId = Guid.NewGuid();
        var controller = Controller<FeatureFlagController>(sender, workspaceId, orgId);

        await controller.DeleteAsync(Guid.NewGuid(), "flag");

        sender.Verify(x => x.Send(It.Is<DeleteFeatureFlag>(r => r.WorkspaceId == workspaceId &&
            r.OrgId == orgId), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UpdateFlag_OverridesBodyOwnershipWithActionContext()
    {
        var sender = new Mock<ISender>();
        var workspaceId = Guid.NewGuid();
        var orgId = Guid.NewGuid();
        var controller = Controller<FeatureFlagController>(sender, workspaceId, orgId);

        await controller.UpdateNameAsync(Guid.NewGuid(), "flag", new UpdateName
        {
            WorkspaceId = Guid.NewGuid(), OrgId = Guid.NewGuid(), Name = "Updated"
        });

        sender.Verify(x => x.Send(It.Is<UpdateName>(r => r.WorkspaceId == workspaceId &&
            r.OrgId == orgId), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UpdateSegment_OverridesBodyOwnershipWithActionContext()
    {
        var sender = new Mock<ISender>();
        var workspaceId = Guid.NewGuid();
        var orgId = Guid.NewGuid();
        var controller = Controller<SegmentController>(sender, workspaceId, orgId);

        await controller.UpdateNameAsync(Guid.NewGuid(), new Application.Segments.UpdateName
        {
            WorkspaceId = Guid.NewGuid(), OrgId = Guid.NewGuid(), Name = "Updated"
        });

        sender.Verify(x => x.Send(It.Is<Application.Segments.UpdateName>(r => r.WorkspaceId == workspaceId &&
            r.OrgId == orgId), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ApplyChangeRequest_ForwardsActionOwnership()
    {
        var sender = new Mock<ISender>();
        var workspaceId = Guid.NewGuid();
        var orgId = Guid.NewGuid();
        var controller = Controller<ChangeRequestController>(sender, workspaceId, orgId);

        await controller.ApplyAsync(Guid.NewGuid(), Guid.NewGuid());

        sender.Verify(x => x.Send(It.Is<ApplyFlagChangeRequest>(r => r.WorkspaceId == workspaceId &&
            r.OrgId == orgId), It.IsAny<CancellationToken>()), Times.Once);
    }

    private static T Controller<T>(Mock<ISender> sender, Guid workspaceId, Guid orgId)
        where T : ControllerBase, new()
    {
        var context = new DefaultHttpContext
        {
            RequestServices = new ServiceCollection().AddSingleton(sender.Object).BuildServiceProvider()
        };
        context.Request.Headers[ApiConstants.WorkspaceHeaderKey] = workspaceId.ToString();
        context.Request.Headers[ApiConstants.OrgIdHeaderKey] = orgId.ToString();
        return new T { ControllerContext = new ControllerContext { HttpContext = context } };
    }
}
