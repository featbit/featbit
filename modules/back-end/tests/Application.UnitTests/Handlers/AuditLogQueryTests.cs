using Application.AuditLogs;
using Application.Bases.Exceptions;
using Application.Services;
using AutoMapper;
using Domain.AuditLogs;
using Domain.Policies;
using Domain.Resources;

namespace Application.UnitTests.Handlers;

public class AuditLogQueryTests
{
    [Theory]
    [InlineData("missing")]
    [InlineData("deny")]
    [InlineData("wrong-resource")]
    [InlineData("wrong-action")]
    public async Task IamPermissionDenied_PreventsBothQueries(string scenario)
    {
        var permissions = IamPermissions();
        if (scenario == "missing") permissions = [];
        if (scenario == "deny")
            permissions = [.. permissions, new PolicyStatement { ResourceType = "iam", Effect = EffectType.Deny,
                Actions = [Permissions.CanManageIAM], Resources = ["iam/*"] }];
        if (scenario == "wrong-resource") permissions[0].Resources = ["project/*"];
        if (scenario == "wrong-action") permissions[0].Actions = [Permissions.CanAccessEnv];
        var logs = new Mock<IAuditLogService>(MockBehavior.Strict);
        var access = new AuditLogAccess();
        var filter = new AuditLogFilter { Scope = AuditLogScope.Iam, CrossEnvironment = true, EnvId = Guid.NewGuid() };
        var list = new GetAuditLogListHandler(logs.Object, Mock.Of<IUserService>(MockBehavior.Strict),
            Mock.Of<IAccessTokenService>(MockBehavior.Strict), Mock.Of<IMapper>(MockBehavior.Strict),
            access);
        await Assert.ThrowsAsync<ForbiddenException>(() => list.Handle(new GetAuditLogList
        {
            Filter = filter, Permissions = permissions
        }, default));
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            new GetAuditLogActorsHandler(logs.Object, access).Handle(new GetAuditLogActors
            {
                Filter = filter, Permissions = permissions
            }, default));
        logs.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task ListsAndActors_UseTheSameScope(bool iam)
    {
        var workspaceId = Guid.NewGuid();
        var orgId = Guid.NewGuid();
        var environment = new Domain.Environments.Environment(Guid.NewGuid(), "Env", "env");
        var filter = new AuditLogFilter { EnvId = environment.Id, CrossEnvironment = true };
        filter.Scope = iam ? AuditLogScope.Iam : AuditLogScope.Environment;
        var logs = new Mock<IAuditLogService>(MockBehavior.Strict);
        var result = new Application.Bases.Models.PagedResult<AuditLog>(0, []);
        logs.Setup(x => x.GetListAsync(workspaceId, orgId, filter)).ReturnsAsync(result);
        logs.Setup(x => x.GetActorsAsync(workspaceId, orgId, filter)).ReturnsAsync(Array.Empty<AuditActor>());
        var mapper = new Mock<IMapper>();
        mapper.Setup(x => x.Map<Application.Bases.Models.PagedResult<AuditLogVm>>(result))
            .Returns(new Application.Bases.Models.PagedResult<AuditLogVm>(0, []));
        var access = new AuditLogAccess();
        var list = new GetAuditLogListHandler(logs.Object, Mock.Of<IUserService>(),
            Mock.Of<IAccessTokenService>(), mapper.Object, access);

        await list.Handle(new GetAuditLogList
        {
            WorkspaceId = workspaceId, OrgId = orgId, Filter = filter, Permissions = iam ? IamPermissions() : []
        }, default);
        await new GetAuditLogActorsHandler(logs.Object, access)
            .Handle(new GetAuditLogActors
            {
                WorkspaceId = workspaceId, OrgId = orgId, Filter = filter, Permissions = iam ? IamPermissions() : []
            }, default);

        logs.VerifyAll();
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task DeniedAccess_PreventsReadingLogsOrActors(bool actors)
    {
        var workspaceId = Guid.NewGuid();
        var orgId = Guid.NewGuid();
        var access = new Mock<IAuditLogAccess>(MockBehavior.Strict);
        access.Setup(x => x.EnsureAsync(It.IsAny<AuditLogFilter>(), It.IsAny<PolicyStatement[]>())).ThrowsAsync(new ForbiddenException());
        var logs = new Mock<IAuditLogService>(MockBehavior.Strict);

        if (actors)
        {
            var handler = new GetAuditLogActorsHandler(logs.Object, access.Object);
            await Assert.ThrowsAsync<ForbiddenException>(() => handler.Handle(new GetAuditLogActors
            {
                WorkspaceId = workspaceId, OrgId = orgId, Filter = new AuditLogFilter()
            }, default));
        }
        else
        {
            var handler = new GetAuditLogListHandler(logs.Object, Mock.Of<IUserService>(MockBehavior.Strict),
                Mock.Of<IAccessTokenService>(MockBehavior.Strict), Mock.Of<IMapper>(MockBehavior.Strict),
                access.Object);
            await Assert.ThrowsAsync<ForbiddenException>(() => handler.Handle(new GetAuditLogList
            {
                WorkspaceId = workspaceId, OrgId = orgId, Filter = new AuditLogFilter()
            }, default));
        }

        logs.VerifyNoOtherCalls();
        access.VerifyAll();
    }

    [Fact]
    public async Task Actors_AuthorizesBeforeQuerying_AndPreservesFilterAndResult()
    {
        var request = new GetAuditLogActors
        {
            WorkspaceId = Guid.NewGuid(), OrgId = Guid.NewGuid(), Permissions = IamPermissions(), Filter = new AuditLogFilter { Scope = AuditLogScope.Iam }
        };
        IReadOnlyList<AuditActor> result = [];
        var sequence = new MockSequence();
        var access = new Mock<IAuditLogAccess>(MockBehavior.Strict);
        access.InSequence(sequence).Setup(x => x.EnsureAsync(request.Filter, request.Permissions))
            .Returns(Task.CompletedTask);
        var logs = new Mock<IAuditLogService>(MockBehavior.Strict);
        logs.InSequence(sequence).Setup(x => x.GetActorsAsync(request.WorkspaceId, request.OrgId, request.Filter)).ReturnsAsync(result);

        var actual = await new GetAuditLogActorsHandler(logs.Object, access.Object).Handle(request, default);

        Assert.Same(result, actual);
        access.VerifyAll();
        logs.VerifyAll();
    }

    private static PolicyStatement[] IamPermissions() =>
        [new PolicyStatement { ResourceType = "iam", Effect = EffectType.Allow,
            Actions = [Permissions.CanManageIAM], Resources = ["iam/*"] }];
}
