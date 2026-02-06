using Domain.Resources;

namespace Api.Authorization;

public static class Permissions
{
    public const string UpdateWorkspaceGeneralSettings = nameof(UpdateWorkspaceGeneralSettings);
    public const string UpdateWorkspaceLicense = nameof(UpdateWorkspaceLicense);
    public const string UpdateWorkspaceSSOSettings = nameof(UpdateWorkspaceSSOSettings);
    
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
    public const string CreateProject = nameof(CreateProject);
    public const string DeleteProject = nameof(DeleteProject);
    public const string UpdateProjectSettings = nameof(UpdateProjectSettings);
    
    public const string CanAccessEnv = nameof(CanAccessEnv);
    public const string CreateEnv = nameof(CreateEnv);
    public const string DeleteEnv = nameof(DeleteEnv);
    public const string UpdateEnvSettings = nameof(UpdateEnvSettings);
    public const string DeleteEnvSecret = nameof(DeleteEnvSecret);
    public const string CreateEnvSecret = nameof(CreateEnvSecret);
    public const string UpdateEnvSecret = nameof(UpdateEnvSecret);
    
    public const string CanManageIAM = nameof(CanManageIAM);

    public static readonly Dictionary<string, string> ResourceMap = new(StringComparer.OrdinalIgnoreCase)
    {
        { UpdateWorkspaceGeneralSettings, ResourceTypes.Workspace },
        { UpdateWorkspaceLicense, ResourceTypes.Workspace },
        { UpdateWorkspaceSSOSettings, ResourceTypes.Workspace },
        
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
        
        { CanAccessProject, ResourceTypes.Project },
        { CreateProject, ResourceTypes.Project },
        { DeleteProject, ResourceTypes.Project },
        { UpdateProjectSettings, ResourceTypes.Project },
        
        { CanAccessEnv, ResourceTypes.Env },
        { CreateEnv, ResourceTypes.Env },
        { DeleteEnv, ResourceTypes.Env },
        { UpdateEnvSettings, ResourceTypes.Env },
        { DeleteEnvSecret, ResourceTypes.Env },
        { CreateEnvSecret, ResourceTypes.Env },
        { UpdateEnvSecret, ResourceTypes.Env },
        
        { CanManageIAM, ResourceTypes.Iam },
    };

    public static readonly string[] All = ResourceMap.Keys.ToArray();

    public static bool IsDefined(string permission)
    {
        return ResourceMap.ContainsKey(permission);
    }
}