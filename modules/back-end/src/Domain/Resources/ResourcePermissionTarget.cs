namespace Domain.Resources;

/// <summary>
/// Identifies the resource against which permissions are checked.
/// </summary>
/// <param name="Rn">The resource name used to match permission policies.</param>
/// <param name="OrganizationId">
/// The organization in which permissions are evaluated. For a shared segment, this is
/// the organization of the environment accessing it. For a workspace target, this is null.
/// </param>
public sealed record ResourcePermissionTarget(string Rn, Guid? OrganizationId);
