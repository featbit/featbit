namespace Api.Authorization;

public enum TenantContextRequirement
{
    None,
    Workspace,
    WorkspaceAndOrganization
}

/// <summary>
/// Declares an action's minimum tenant context. Unmarked actions require workspace and organization.
/// Supplied context is still validated even when the action allows it to be omitted.
/// </summary>
[AttributeUsage(AttributeTargets.Method)]
public sealed class TenantContextAttribute(TenantContextRequirement requirement) : Attribute
{
    public TenantContextRequirement Requirement { get; } = requirement;
}
