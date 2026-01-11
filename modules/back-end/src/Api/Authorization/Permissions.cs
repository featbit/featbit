using Domain.Resources;

namespace Api.Authorization;

public static class Permissions
{
    // Flags
    public const string CreateFlag = nameof(CreateFlag);
    public const string ArchiveFlag = nameof(ArchiveFlag);
    public const string RestoreFlag = nameof(RestoreFlag);
    public const string DeleteFlag = nameof(DeleteFlag);
    public const string CloneFlag = nameof(CloneFlag);
    public const string CopyFlagTo = nameof(CopyFlagTo);
    public const string ToggleFlag = nameof(ToggleFlag);
    public const string UpdateFlagName = nameof(UpdateFlagName);
    public const string UpdateFlagDescription = nameof(UpdateFlagDescription);
    public const string UpdateFlagOffVariation = nameof(UpdateFlagOffVariation);
    public const string UpdateFlagVariations = nameof(UpdateFlagVariations);
    public const string UpdateFlagTags = nameof(UpdateFlagTags);

    public const string ManageSegment = nameof(ManageSegment);
    public const string CanAccessProject = nameof(CanAccessProject);

    public static readonly Dictionary<string, string> ResourceMap = new(StringComparer.OrdinalIgnoreCase)
    {
        // Flags
        { CreateFlag, ResourceTypes.FeatureFlag },
        { ArchiveFlag, ResourceTypes.FeatureFlag },
        { RestoreFlag, ResourceTypes.FeatureFlag },
        { DeleteFlag, ResourceTypes.FeatureFlag },
        { CloneFlag, ResourceTypes.FeatureFlag },
        { CopyFlagTo, ResourceTypes.FeatureFlag },
        { ToggleFlag, ResourceTypes.FeatureFlag },
        { UpdateFlagName, ResourceTypes.FeatureFlag },
        { UpdateFlagDescription, ResourceTypes.FeatureFlag },
        { UpdateFlagOffVariation, ResourceTypes.FeatureFlag },
        { UpdateFlagVariations, ResourceTypes.FeatureFlag },
        { UpdateFlagTags, ResourceTypes.FeatureFlag },

        { ManageSegment, ResourceTypes.Segment },
        { CanAccessProject, ResourceTypes.Project }
    };

    public static readonly string[] All = ResourceMap.Keys.ToArray();

    public static bool IsDefined(string permission)
    {
        return ResourceMap.ContainsKey(permission);
    }
}