namespace Api.Authorization;

public enum TenantContextRequirement
{
    None,
    Workspace,
    WorkspaceAndOrganization
}

[AttributeUsage(AttributeTargets.Method)]
public sealed class TenantContextAttribute(TenantContextRequirement requirement) : Attribute
{
    public TenantContextRequirement Requirement { get; } = requirement;
}
