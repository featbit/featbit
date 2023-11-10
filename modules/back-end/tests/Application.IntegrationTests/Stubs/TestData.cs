using Domain.Users;
using Domain.Workspaces;

namespace Application.IntegrationTests.Stubs;

public class TestData
{
    public static readonly Guid WorkspaceId = new("ef82c894-d9b5-4846-99e9-ae27ab7d247d");
    public const string WorkspaceKey = "ws-key";
    public static readonly Guid Id = new("d082c894-d9b5-4846-99e9-ae27ab7d247d");
    public const string Email = "test@email.com";
    public const string RealPassword = "pwd";
    public const string HashedPassword = "hashed-pwd";

    public static User User()
    {
        return new User(WorkspaceId, Id, Email, HashedPassword);
    }

    public static Workspace Workspace()
    {
        return new Workspace
        {
            Id = WorkspaceId,
            Key = WorkspaceKey
        };
    }
}