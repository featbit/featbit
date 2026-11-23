using Api.Controllers;
using Application.ReleaseMetricSourceConnections;
using Domain.Policies;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Api.UnitTests.Controllers;

public class ReleaseMetricSourceConnectionControllerAuthorizationTests
{
    [Theory]
    [InlineData(nameof(ReleaseMetricSourceConnectionController.GetListAsync), false)]
    [InlineData(nameof(ReleaseMetricSourceConnectionController.GetAsync), false)]
    [InlineData(nameof(ReleaseMetricSourceConnectionController.CreateAsync), true)]
    [InlineData(nameof(ReleaseMetricSourceConnectionController.UpdateAsync), true)]
    [InlineData(nameof(ReleaseMetricSourceConnectionController.DeleteAsync), true)]
    [InlineData(nameof(ReleaseMetricSourceConnectionController.TestAsync), true)]
    public void Action_RequiresEnvironmentPermissions(string action, bool requiresUpdate)
    {
        var controller = typeof(ReleaseMetricSourceConnectionController);
        var method = controller.GetMethod(action)!;
        var attributes = controller.GetCustomAttributes(inherit: true)
            .Concat(method.GetCustomAttributes(inherit: true)).ToArray();
        var policies = attributes.OfType<AuthorizeAttribute>()
            .Select(attribute => attribute.Policy)
            .OfType<string>()
            .Order();
        string[] expected = requiresUpdate
            ? [Permissions.CanAccessEnv, Permissions.UpdateEnvSettings]
            : [Permissions.CanAccessEnv];

        Assert.DoesNotContain(attributes, attribute => attribute is IAllowAnonymous);
        Assert.Equal(expected.Order(), policies);
    }

    [Fact]
    public async Task Actions_SendCurrentOrganizationAndRouteEnvironment()
    {
        var orgId = Guid.NewGuid();
        var envId = Guid.NewGuid();
        var id = Guid.NewGuid();
        var draft = new TestReleaseMetricSourceConnectionPayload { ConnectionId = id };
        var connection = new ReleaseMetricSourceConnectionVm(id, envId, "Metrics", "prometheus-compatible",
            default, default, DateTime.UtcNow, DateTime.UtcNow);
        var result = new ConnectionTestResult("connected", null);
        var sender = new Mock<ISender>(MockBehavior.Strict);
        var context = new DefaultHttpContext();
        context.Request.Headers[ApiConstants.OrgIdHeaderKey] = orgId.ToString();
        context.RequestServices = Mock.Of<IServiceProvider>(services => services.GetService(typeof(ISender)) == sender.Object);
        var controller = new ReleaseMetricSourceConnectionController
        {
            ControllerContext = new ControllerContext { HttpContext = context }
        };

        sender.Setup(x => x.Send(It.Is<GetReleaseMetricSourceConnectionList>(q => q.OrgId == orgId && q.EnvId == envId),
            context.RequestAborted)).ReturnsAsync([connection]);
        sender.Setup(x => x.Send(It.Is<GetReleaseMetricSourceConnection>(q => q.OrgId == orgId && q.EnvId == envId && q.Id == id),
            context.RequestAborted)).ReturnsAsync(connection);
        sender.Setup(x => x.Send(It.Is<CreateReleaseMetricSourceConnection>(q => q.OrgId == orgId && q.EnvId == envId),
            context.RequestAborted)).ReturnsAsync(connection);
        sender.Setup(x => x.Send(It.Is<UpdateReleaseMetricSourceConnection>(q => q.OrgId == orgId && q.EnvId == envId && q.Id == id),
            context.RequestAborted)).ReturnsAsync(connection);
        sender.Setup(x => x.Send(It.Is<DeleteReleaseMetricSourceConnection>(q => q.OrgId == orgId && q.EnvId == envId && q.Id == id),
            context.RequestAborted)).ReturnsAsync(true);
        sender.Setup(x => x.Send(It.Is<TestReleaseMetricSourceConnection>(q => q.OrgId == orgId && q.EnvId == envId && q.Payload == draft),
            context.RequestAborted)).ReturnsAsync(result);

        var list = await controller.GetListAsync(envId);
        Assert.NotNull(list.Data);
        Assert.Same(connection, Assert.Single(list.Data));
        Assert.Same(connection, (await controller.GetAsync(envId, id)).Data);
        Assert.Same(connection, (await controller.CreateAsync(envId, new())).Data);
        Assert.Same(connection, (await controller.UpdateAsync(envId, id, new())).Data);
        Assert.True((await controller.DeleteAsync(envId, id)).Data);
        Assert.Same(result, (await controller.TestAsync(envId, draft)).Data);
    }
}
