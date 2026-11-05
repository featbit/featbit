namespace Api.Authorization;

public enum TenantContextRequirement
{
    None,
    Workspace,
    WorkspaceAndOrganization
}

/// <summary>
/// Declares the minimum tenant context. Unmarked actions require workspace and organization.
/// None bypasses tenant context validation, including supplied context, without bypassing authentication or authorization.
/// Other requirements also validate any supplied non-empty organization context.
/// </summary>
[AttributeUsage(AttributeTargets.Method)]
public sealed class TenantContextAttribute(TenantContextRequirement requirement) : Attribute
{
    public TenantContextRequirement Requirement { get; } = requirement;
}
