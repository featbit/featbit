using Application.AuditLogs;
using Application.Bases.Exceptions;
using Domain.Policies;
using Domain.Resources;

namespace Application.UnitTests.Handlers;

public class AuditLogAccessTests
{
    [Fact]
    public async Task Iam_RequiresCanManageIAM()
    {
        var access = new AuditLogAccess();
        var filter = new AuditLogFilter { Scope = AuditLogScope.Iam };

        await Assert.ThrowsAsync<ForbiddenException>(() => access.EnsureAsync(filter, []));
        await access.EnsureAsync(filter,
            [new PolicyStatement { ResourceType = "iam", Effect = EffectType.Allow,
                Actions = [Permissions.CanManageIAM], Resources = ["iam/*"] }]);
    }

    [Theory]
    [InlineData(AuditLogScope.Environment)]
    [InlineData(AuditLogScope.Unspecified)]
    [InlineData((AuditLogScope)999)]
    public async Task NonIamScope_DoesNotRequireIamPermissionOrEnvironment(AuditLogScope scope)
    {
        await new AuditLogAccess().EnsureAsync(new AuditLogFilter { Scope = scope }, []);
    }
}
