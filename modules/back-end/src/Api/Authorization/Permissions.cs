using Domain.Resources;

namespace Api.Authorization;

public static class Permissions
{
    public const string ManageFeatureFlag = nameof(ManageFeatureFlag);
    public const string ManageSegment = nameof(ManageSegment);
    public const string ListProjects = nameof(ListProjects);
    public const string ReadProject = nameof(ReadProject);

    public static readonly Dictionary<string, string> ResourceMap = new(StringComparer.OrdinalIgnoreCase)
    {
        { ManageFeatureFlag, ResourceTypes.FeatureFlag },
        { ManageSegment, ResourceTypes.Segment },
        { ListProjects, ResourceTypes.Project },
        { ReadProject, ResourceTypes.Project }
    };

    public static readonly string[] All = ResourceMap.Keys.ToArray();

    public static bool IsDefined(string permission)
    {
        return ResourceMap.ContainsKey(permission);
    }
}