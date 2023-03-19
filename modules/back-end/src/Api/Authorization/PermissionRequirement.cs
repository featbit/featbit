namespace Api.Authorization;

public class PermissionRequirement : IAuthorizationRequirement
{
    public string PermissionName { get; }

    public PermissionRequirement(string permissionName)
    {
        if (string.IsNullOrWhiteSpace(permissionName))
        {
            throw new ArgumentException("Permission cannot be null or whitespace.", nameof(permissionName));
        }

        PermissionName = permissionName;
    }

    public override string ToString()
    {
        return $"PermissionRequirement: {PermissionName}";
    }
}