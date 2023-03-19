namespace Domain.Resources;

public class PermissionAction
{
    public string Name { get; set; }

    public string ResourceType { get; set; }

    public string GetRn()
    {
        return $"{ResourceType}/*";
    }
}

public static class Actions
{
    public const string ListAccessTokens = nameof(ListAccessTokens);
}

public static class PermissionActions
{
    private static readonly IDictionary<string, PermissionAction> Actions = new Dictionary<string, PermissionAction>
    {
        {
            Resources.Actions.ListAccessTokens,
            new PermissionAction
            {
                Name = Resources.Actions.ListAccessTokens,
                ResourceType = ResourceType.AccessToken
            }
        }
    };

    public static PermissionAction GetPermissionActionByName(string name)
    {
        return !Actions.TryGetValue(name, out var permissionAction) ? null : permissionAction;
    }
}