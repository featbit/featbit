namespace Api.Authorization;

public class PermissionRequirement : IAuthorizationRequirement
{
    public string PermissionName { get; }

    public PermissionRequirement(string permissionName)
    {
        if (!Permissions.IsDefined(permissionName))
        {
            throw new ArgumentException($"The permission '{permissionName}' is not defined.", nameof(permissionName));
        }

        PermissionName = permissionName;
    }

    public override string ToString()
    {
        return $"PermissionRequirement: {PermissionName}";
    }
}