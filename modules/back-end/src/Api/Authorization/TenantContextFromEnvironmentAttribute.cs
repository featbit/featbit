namespace Api.Authorization;

/// <summary>
/// Resolves tenant context from the envId route before tenant and permission checks.
/// Supplied tenant headers must match the environment's actual organization and workspace.
/// </summary>
[AttributeUsage(AttributeTargets.Method)]
public sealed class TenantContextFromEnvironmentAttribute : Attribute;
