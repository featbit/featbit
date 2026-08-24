using System.Linq.Expressions;
using Application.EndUsers;
using Application.Services;
using Domain.EndUsers;

namespace Application.UnitTests.Handlers;

public class GetEndUserByKeyIdsHandlerTests
{
    [Fact]
    public async Task Handle_ReturnsEnvironmentAndWorkspaceUsersAndPrefersEnvironmentMatch()
    {
        var workspaceId = Guid.NewGuid();
        var otherWorkspaceId = Guid.NewGuid();
        var envId = Guid.NewGuid();
        var otherEnvId = Guid.NewGuid();
        var users = new EndUser[]
        {
            User(workspaceId, null, "global-only", "Global only"),
            User(workspaceId, null, "shared-key", "Global duplicate"),
            User(null, envId, "environment-only", "Environment only"),
            User(null, envId, "shared-key", "Environment duplicate"),
            User(otherWorkspaceId, null, "other-workspace", "Other workspace"),
            User(null, otherEnvId, "other-environment", "Other environment")
        };
        var service = new Mock<IEndUserService>();
        service
            .Setup(x => x.FindManyAsync(It.IsAny<Expression<Func<EndUser, bool>>>()))
            .ReturnsAsync((Expression<Func<EndUser, bool>> predicate) =>
                users.Where(predicate.Compile()).ToArray()
            );
        var handler = new GetEndUserByKeyIdsHandler(service.Object);

        var result = (await handler.Handle(
            new GetEndUserByKeyIds
            {
                WorkspaceId = workspaceId,
                EnvId = envId,
                KeyIds =
                [
                    "global-only",
                    "environment-only",
                    "shared-key",
                    "other-workspace",
                    "other-environment"
                ]
            },
            CancellationToken.None
        )).ToArray();

        Assert.Equal(3, result.Length);
        Assert.Contains(result, user => user.KeyId == "global-only" && user.EnvId == null);
        Assert.Contains(result, user => user.KeyId == "environment-only" && user.EnvId == envId);
        Assert.Contains(result, user =>
            user.KeyId == "shared-key" &&
            user.EnvId == envId &&
            user.Name == "Environment duplicate"
        );
        Assert.DoesNotContain(result, user => user.KeyId == "other-workspace");
        Assert.DoesNotContain(result, user => user.KeyId == "other-environment");
    }

    private static EndUser User(Guid? workspaceId, Guid? envId, string keyId, string name)
    {
        return new EndUser(workspaceId, envId, keyId, name, []);
    }
}
