namespace Domain.AuditLogs;

public class Operations
{
    public const string Create = nameof(Create);
    public const string Update = nameof(Update);
    public const string Archive = nameof(Archive);
    public const string Restore = nameof(Restore);
    public const string Remove = nameof(Remove);
    public const string ApproveFlagChangeRequest = nameof(ApproveFlagChangeRequest);
    public const string DeclineFlagChangeRequest = nameof(DeclineFlagChangeRequest);
    public const string ApplyFlagChangeRequest = nameof(ApplyFlagChangeRequest);
    public const string ApplyFlagSchedule = nameof(ApplyFlagSchedule);

    public const string CreateGroup = nameof(CreateGroup);
    public const string UpdateGroup = nameof(UpdateGroup);
    public const string DeleteGroup = nameof(DeleteGroup);
    public const string AddGroupMember = nameof(AddGroupMember);
    public const string RemoveGroupMember = nameof(RemoveGroupMember);
    public const string AddGroupPolicy = nameof(AddGroupPolicy);
    public const string RemoveGroupPolicy = nameof(RemoveGroupPolicy);
    public const string CreatePolicy = nameof(CreatePolicy);
    public const string ClonePolicy = nameof(ClonePolicy);
    public const string UpdatePolicySetting = nameof(UpdatePolicySetting);
    public const string UpdatePolicyStatements = nameof(UpdatePolicyStatements);
    public const string DeletePolicy = nameof(DeletePolicy);
    public const string AddMember = nameof(AddMember);
    public const string AddMemberPolicy = nameof(AddMemberPolicy);
    public const string RemoveMemberPolicy = nameof(RemoveMemberPolicy);
    public const string RemoveFromOrganization = nameof(RemoveFromOrganization);
    public const string RemoveFromWorkspace = nameof(RemoveFromWorkspace);
    public const string UpdateProfile = nameof(UpdateProfile);

    public static readonly string[] All =
    [
        Create,
        Update,
        Archive,
        Restore,
        Remove,
        ApproveFlagChangeRequest,
        DeclineFlagChangeRequest,
        ApplyFlagChangeRequest,
        ApplyFlagSchedule,
        CreateGroup,
        UpdateGroup,
        DeleteGroup,
        AddGroupMember,
        RemoveGroupMember,
        AddGroupPolicy,
        RemoveGroupPolicy,
        CreatePolicy,
        ClonePolicy,
        UpdatePolicySetting,
        UpdatePolicyStatements,
        DeletePolicy,
        AddMember,
        AddMemberPolicy,
        RemoveMemberPolicy,
        RemoveFromOrganization,
        RemoveFromWorkspace,
        UpdateProfile
    ];

    public static bool IsDefined(string type)
    {
        return All.Contains(type);
    }
}
