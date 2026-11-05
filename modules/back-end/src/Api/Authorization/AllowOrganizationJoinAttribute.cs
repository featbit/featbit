namespace Api.Authorization;

/// <summary>
/// Uses SSO onboarding authorization instead of requiring existing organization membership.
/// This marker alone never grants permission to join an organization.
/// </summary>
[AttributeUsage(AttributeTargets.Method)]
public sealed class AllowOrganizationJoinAttribute : Attribute;
