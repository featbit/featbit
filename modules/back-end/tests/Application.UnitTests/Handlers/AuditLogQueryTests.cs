using Application.AuditLogs;
using Application.Bases.Exceptions;
using Application.Services;
using AutoMapper;
using Domain.AuditLogs;

namespace Application.UnitTests.Handlers;

public class AuditLogQueryTests
{
    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task DeniedAccess_PreventsReadingLogsOrActors(bool actors)
    {
        var workspaceId = Guid.NewGuid();
        var orgId = Guid.NewGuid();
        var access = new Mock<IAuditLogAccess>(MockBehavior.Strict);
        access.Setup(x => x.EnsureAsync(workspaceId, orgId)).ThrowsAsync(new ForbiddenException());
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
                Mock.Of<IOrganizationService>(MockBehavior.Strict), Mock.Of<IEnvironmentService>(MockBehavior.Strict),
                Mock.Of<IProjectService>(MockBehavior.Strict), access.Object);
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
            WorkspaceId = Guid.NewGuid(), OrgId = Guid.NewGuid(), Filter = new AuditLogFilter()
        };
        IReadOnlyList<AuditActor> result = [];
        var sequence = new MockSequence();
        var access = new Mock<IAuditLogAccess>(MockBehavior.Strict);
        access.InSequence(sequence).Setup(x => x.EnsureAsync(request.WorkspaceId, request.OrgId))
            .Returns(Task.CompletedTask);
        var logs = new Mock<IAuditLogService>(MockBehavior.Strict);
        logs.InSequence(sequence).Setup(x => x.GetActorsAsync(request.WorkspaceId, request.Filter)).ReturnsAsync(result);

        var actual = await new GetAuditLogActorsHandler(logs.Object, access.Object).Handle(request, default);

        Assert.Same(result, actual);
        access.VerifyAll();
        logs.VerifyAll();
    }
}
