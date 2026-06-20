using Domain.Workspaces;

namespace Application.IntegrationTests.Stubs;

public static class TestWorkspace
{
    public static readonly Guid Id = new("ef82c894-d9b5-4846-99e9-ae27ab7d247d");
    public static readonly Guid OrganizationId = new("ef82c894-d9b5-4846-99e9-ae27ab7d247e");
    public const string Key = "ws-key";

    public static readonly Workspace Instance = new()
    {
        Id = Id,
        Key = Key
    };
}
