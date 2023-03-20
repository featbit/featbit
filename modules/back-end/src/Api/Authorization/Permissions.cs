using Domain.Resources;

namespace Api.Authorization;

public static class Permissions
{
    public const string CreateFeatureFlag = nameof(CreateFeatureFlag);

    public static readonly Dictionary<string, string> ResourceMap = new(StringComparer.OrdinalIgnoreCase)
    {
        { CreateFeatureFlag, ResourceTypes.FeatureFlag }
    };

    public static readonly string[] All = ResourceMap.Keys.ToArray();

    public static bool IsDefined(string permission)
    {
        return ResourceMap.ContainsKey(permission);
    }
}