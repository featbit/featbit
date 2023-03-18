namespace Domain.Resources;

public class PermissionAction {
    public string Name { get; set; }
    public string ResourceType { get; set; }

    public string GetResourceName()
    {
        return $"{ResourceType}/*";
    }
}

public static class PermissionActionName
{
    public const string ListAccessTokens = nameof(ListAccessTokens);
    public const string ManageServiceAccessTokens = nameof(ManageServiceAccessTokens);
    public const string ManagePersonalAccessTokens = nameof(ManagePersonalAccessTokens);
}

public static class PermissionActions
{
    private static IDictionary<string, PermissionAction> _actions = new Dictionary<string, PermissionAction>
    {
        { PermissionActionName.ListAccessTokens,  new PermissionAction { Name = PermissionActionName.ListAccessTokens, ResourceType = ResourceType.AccessToken }},
        { PermissionActionName.ManageServiceAccessTokens,  new PermissionAction { Name = PermissionActionName.ManageServiceAccessTokens, ResourceType = ResourceType.AccessToken }},
        { PermissionActionName.ManagePersonalAccessTokens,  new PermissionAction { Name = PermissionActionName.ManagePersonalAccessTokens, ResourceType = ResourceType.AccessToken }},
    };

    public static PermissionAction GetPermissionActionByName(string name)
    {
        return !_actions.TryGetValue(name, out var permissionAction) ? null : permissionAction;
    }
}