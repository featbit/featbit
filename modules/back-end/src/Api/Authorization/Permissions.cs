using Domain.Resources;

namespace Api.Authorization;

public static class Permissions
{
    public const string ManageFeatureFlag = nameof(ManageFeatureFlag);
    public const string ManageSegment = nameof(ManageSegment);

    public static readonly Dictionary<string, string> ResourceMap = new(StringComparer.OrdinalIgnoreCase)
    {
        { ManageFeatureFlag, ResourceTypes.FeatureFlag },
        { ManageSegment, ResourceTypes.Segment }
    };

    public static readonly string[] All = ResourceMap.Keys.ToArray();

    public static bool IsDefined(string permission)
    {
        return ResourceMap.ContainsKey(permission);
    }
}