using Api.Authorization;
using Api.Controllers;
using Application;
using Application.Bases.Exceptions;
using Application.ReleaseMetricSourceConnections;
using Application.Services;
using Domain.AccessTokens;
using Domain.Environments;
using Domain.Policies;
using Domain.Resources;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Api.UnitTests.Controllers;

public class ReleaseMetricSourceConnectionControllerAuthorizationTests
{
    private readonly Guid _orgId = Guid.NewGuid();
    private readonly Guid _envId = Guid.NewGuid();
    private readonly Guid _connectionId = Guid.NewGuid();
    private readonly Mock<ISender> _sender = new(MockBehavior.Strict);
    private readonly Mock<IOrganizationService> _organizations = new(MockBehavior.Strict);

    [Fact]
    public async Task ReadOnlyUser_CanListConnections()
    {
        var controller = CreateController(_orgId, Permissions.CanAccessEnv);
        _sender.Setup(x => x.Send(It.Is<GetReleaseMetricSourceConnectionList>(q => q.EnvId == _envId), It.IsAny<CancellationToken>()))
            .ReturnsAsync(Array.Empty<ReleaseMetricSourceConnectionVm>());

        var response = await controller.GetListAsync(_envId);

        Assert.True(response.Success);
        _sender.VerifyAll();
    }

    [Fact]
    public async Task ReadOnlyUser_CannotCreateUpdateOrDelete()
    {
        var controller = CreateController(_orgId, Permissions.CanAccessEnv);

        await Assert.ThrowsAsync<ForbiddenException>(() => controller.CreateAsync(_envId, new CreateReleaseMetricSourceConnection()));
        await Assert.ThrowsAsync<ForbiddenException>(() => controller.UpdateAsync(_envId, _connectionId, new UpdateReleaseMetricSourceConnection()));
        await Assert.ThrowsAsync<ForbiddenException>(() => controller.DeleteAsync(_envId, _connectionId));

        Assert.Empty(_sender.Invocations);
    }

    [Fact]
    public async Task ForeignEnvironment_WithMatchingResourceKeys_RejectsAccess()
    {
        var otherOrgId = Guid.NewGuid();
        var controller = CreateController(otherOrgId, Permissions.CanAccessEnv, Permissions.UpdateEnvSettings);

        await Assert.ThrowsAsync<ForbiddenException>(() => controller.GetAsync(_envId, _connectionId));
        await Assert.ThrowsAsync<ForbiddenException>(() => controller.DeleteAsync(_envId, _connectionId));

        Assert.Empty(_sender.Invocations);
    }

    [Fact]
    public async Task PersonalToken_WhoseCreatorLeftOrganization_CannotReadOrWrite()
    {
        var controller = CreateController(_orgId, Permissions.CanAccessEnv, Permissions.UpdateEnvSettings);
        var creatorId = Guid.NewGuid();
        controller.HttpContext.Items[ApplicationConsts.AccessTokenItem] =
            new AccessToken(_orgId, creatorId, "reader", AccessTokenTypes.Personal, []);
        _organizations.Setup(x => x.ContainsUserAsync(_orgId, creatorId)).ReturnsAsync(false);

        await Assert.ThrowsAsync<ForbiddenException>(() => controller.GetListAsync(_envId));
        await Assert.ThrowsAsync<ForbiddenException>(() => controller.CreateAsync(_envId, new CreateReleaseMetricSourceConnection()));

        _organizations.Verify(x => x.ContainsUserAsync(_orgId, creatorId), Times.Exactly(2));
        Assert.Empty(_sender.Invocations);
    }

    [Fact]
    public async Task AuthorizedUser_CanCreateUpdateAndDeleteInEnvironment()
    {
        var controller = CreateController(_orgId, Permissions.CanAccessEnv, Permissions.UpdateEnvSettings);
        var connection = new ReleaseMetricSourceConnectionVm(_connectionId, _envId, "Metrics", "azure-monitor", default, default,
            DateTime.UtcNow, DateTime.UtcNow);
        _sender.Setup(x => x.Send(It.Is<CreateReleaseMetricSourceConnection>(c => c.EnvId == _envId), It.IsAny<CancellationToken>()))
            .ReturnsAsync(connection);
        _sender.Setup(x => x.Send(It.Is<UpdateReleaseMetricSourceConnection>(c => c.EnvId == _envId && c.Id == _connectionId),
            It.IsAny<CancellationToken>())).ReturnsAsync(connection);
        _sender.Setup(x => x.Send(It.Is<DeleteReleaseMetricSourceConnection>(c => c.EnvId == _envId && c.Id == _connectionId),
            It.IsAny<CancellationToken>())).ReturnsAsync(true);

        var created = await controller.CreateAsync(_envId, new CreateReleaseMetricSourceConnection());
        var updated = await controller.UpdateAsync(_envId, _connectionId, new UpdateReleaseMetricSourceConnection());
        var deleted = await controller.DeleteAsync(_envId, _connectionId);

        Assert.Same(connection, created.Data);
        Assert.Same(connection, updated.Data);
        Assert.True(deleted.Data);
        _sender.VerifyAll();
    }

    private ReleaseMetricSourceConnectionController CreateController(Guid environmentOrgId, params string[] actions)
    {
        var environments = new Mock<IEnvironmentService>();
        environments.Setup(x => x.GetResourceDescriptorAsync(_envId)).ReturnsAsync(new ResourceDescriptor
        {
            Organization = new IdNameKeyProps { Id = environmentOrgId },
            Project = new IdNameKeyProps { Key = "shop" },
            Environment = new IdNameKeyProps { Id = _envId, Key = "production" }
        });

        var context = new DefaultHttpContext();
        context.Request.Headers[ApiConstants.OrgIdHeaderKey] = _orgId.ToString();
        var permissions = new Mock<IRequestPermissions>();
        permissions.Setup(x => x.GetAsync(context)).ReturnsAsync([new PolicyStatement
        {
            ResourceType = ResourceTypes.Env, Effect = EffectType.Allow,
            Actions = actions, Resources = [RN.ForEnv("shop", "production")]
        }]);
        context.RequestServices = Mock.Of<IServiceProvider>(services =>
            services.GetService(typeof(ISender)) == _sender.Object &&
            services.GetService(typeof(IRequestPermissions)) == permissions.Object);

        return new ReleaseMetricSourceConnectionController(environments.Object, _organizations.Object)
        {
            ControllerContext = new ControllerContext { HttpContext = context }
        };
    }
}
