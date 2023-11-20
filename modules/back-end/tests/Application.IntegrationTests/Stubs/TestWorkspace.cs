using Domain.Workspaces;

namespace Application.IntegrationTests.Stubs;

public static class TestWorkspace
{
    public static readonly Guid Id = new("ef82c894-d9b5-4846-99e9-ae27ab7d247d");
    public const string Key = "ws-key";

    public static Workspace Instance()
    {
        return new Workspace
        {
            Id = Id,
            Key = Key
        };
    }
}