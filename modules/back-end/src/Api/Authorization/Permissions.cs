using Domain.Resources;

namespace Api.Authorization;

public static class Permissions
{
    // Workspaces
    public const string UpdateWorkspaceGeneralSettings = nameof(UpdateWorkspaceGeneralSettings);
    public const string UpdateWorkspaceLicense = nameof(UpdateWorkspaceLicense);
    public const string UpdateWorkspaceSSOSettings = nameof(UpdateWorkspaceSSOSettings);

    // IAM
    public const string CanManageIAM = nameof(CanManageIAM);

    // Projects
    public const string CanAccessProject = nameof(CanAccessProject);
    public const string CreateProject = nameof(CreateProject);
    public const string DeleteProject = nameof(DeleteProject);
    public const string UpdateProjectSettings = nameof(UpdateProjectSettings);

    // Environments
    public const string CanAccessEnv = nameof(CanAccessEnv);
    public const string CreateEnv = nameof(CreateEnv);
    public const string DeleteEnv = nameof(DeleteEnv);
    public const string UpdateEnvSettings = nameof(UpdateEnvSettings);
    public const string DeleteEnvSecret = nameof(DeleteEnvSecret);
    public const string CreateEnvSecret = nameof(CreateEnvSecret);
    public const string UpdateEnvSecret = nameof(UpdateEnvSecret);

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

    // Segments
    public const string ManageSegment = nameof(ManageSegment);

    public static readonly Dictionary<string, string> ResourceMap = new(StringComparer.OrdinalIgnoreCase)
    {
        // Workspaces
        { UpdateWorkspaceGeneralSettings, ResourceTypes.Workspace },
        { UpdateWorkspaceLicense, ResourceTypes.Workspace },
        { UpdateWorkspaceSSOSettings, ResourceTypes.Workspace },

        // IAM
        { CanManageIAM, ResourceTypes.Iam },

        // Projects
        { CanAccessProject, ResourceTypes.Project },
        { CreateProject, ResourceTypes.Project },
        { DeleteProject, ResourceTypes.Project },
        { UpdateProjectSettings, ResourceTypes.Project },
        { CreateEnv, ResourceTypes.Project },

        // Environments
        { CanAccessEnv, ResourceTypes.Env },
        { DeleteEnv, ResourceTypes.Env },
        { UpdateEnvSettings, ResourceTypes.Env },
        { DeleteEnvSecret, ResourceTypes.Env },
        { CreateEnvSecret, ResourceTypes.Env },
        { UpdateEnvSecret, ResourceTypes.Env },

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

        // Segments
        { ManageSegment, ResourceTypes.Segment }
    };

    public static readonly string[] All = ResourceMap.Keys.ToArray();

    public static bool IsDefined(string permission)
    {
        return ResourceMap.ContainsKey(permission);
    }
}