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
    public async Task IamPermissionDenied_PreventsListQuery(string scenario)
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
        var filter = new AuditLogFilter { Scope = AuditLogScope.Iam, CrossEnvironment = true };
        var list = new GetAuditLogListHandler(logs.Object, Mock.Of<IUserService>(MockBehavior.Strict),
            Mock.Of<IAccessTokenService>(MockBehavior.Strict), Mock.Of<IMapper>(MockBehavior.Strict),
            access);
        await Assert.ThrowsAsync<ForbiddenException>(() => list.Handle(new GetAuditLogList
        {
            Filter = filter, Permissions = permissions
        }, default));
        logs.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Lists_PreserveScope(bool iam)
    {
        var workspaceId = Guid.NewGuid();
        var orgId = Guid.NewGuid();
        var environment = new Domain.Environments.Environment(Guid.NewGuid(), "Env", "env");
        var filter = new AuditLogFilter { CrossEnvironment = true };
        filter.Scope = iam ? AuditLogScope.Iam : AuditLogScope.Environment;
        var logs = new Mock<IAuditLogService>(MockBehavior.Strict);
        var result = new Application.Bases.Models.PagedResult<AuditLog>(0, []);
        logs.Setup(x => x.GetListAsync(workspaceId, orgId, environment.Id, filter)).ReturnsAsync(result);
        var mapper = new Mock<IMapper>();
        mapper.Setup(x => x.Map<Application.Bases.Models.PagedResult<AuditLogVm>>(result))
            .Returns(new Application.Bases.Models.PagedResult<AuditLogVm>(0, []));
        var access = new AuditLogAccess();
        var list = new GetAuditLogListHandler(logs.Object, Mock.Of<IUserService>(),
            Mock.Of<IAccessTokenService>(), mapper.Object, access);

        await list.Handle(new GetAuditLogList
        {
            WorkspaceId = workspaceId, OrgId = orgId, EnvId = environment.Id, Filter = filter, Permissions = iam ? IamPermissions() : []
        }, default);

        logs.VerifyAll();
    }

    [Fact]
    public async Task DeniedAccess_PreventsReadingLogs()
    {
        var workspaceId = Guid.NewGuid();
        var orgId = Guid.NewGuid();
        var access = new Mock<IAuditLogAccess>(MockBehavior.Strict);
        access.Setup(x => x.EnsureAsync(It.IsAny<AuditLogFilter>(), It.IsAny<PolicyStatement[]>())).ThrowsAsync(new ForbiddenException());
        var logs = new Mock<IAuditLogService>(MockBehavior.Strict);

        var handler = new GetAuditLogListHandler(logs.Object, Mock.Of<IUserService>(MockBehavior.Strict),
            Mock.Of<IAccessTokenService>(MockBehavior.Strict), Mock.Of<IMapper>(MockBehavior.Strict),
            access.Object);
        await Assert.ThrowsAsync<ForbiddenException>(() => handler.Handle(new GetAuditLogList
        {
            WorkspaceId = workspaceId, OrgId = orgId, Filter = new AuditLogFilter()
        }, default));

        logs.VerifyNoOtherCalls();
        access.VerifyAll();
    }

    private static PolicyStatement[] IamPermissions() =>
        [new PolicyStatement { ResourceType = "iam", Effect = EffectType.Allow,
            Actions = [Permissions.CanManageIAM], Resources = ["iam/*"] }];
}
