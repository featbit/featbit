#nullable enable annotations

using Application.Bases.Models;

namespace Application.AuditLogs;

public class AuditLogQueryFilter : PagedRequest
{
    /// <summary>
    /// Required. Allowed values (case-sensitive): Environment, Organization, Workspace.
    /// Workspace queries are not currently supported and return 403.
    /// </summary>
    public string Scope { get; set; } = "";

    /// <summary>
    /// Required. The environment, organization or workspace ID corresponding to scope. Must not be an empty GUID.
    /// </summary>
    public Guid ScopeId { get; set; }

    /// <summary>
    /// Optional. Allowed values (case-sensitive): FeatureFlag, Segment, Member, Group, Policy.
    /// Defaults to the types currently supported by the scope: FeatureFlag and Segment for Environment;
    /// Member, Group and Policy for Organization.
    /// Types must match the scope. Multiple values match any selected type.
    /// Example: refTypes=FeatureFlag&amp;refTypes=Segment.
    /// </summary>
    public string[] RefTypes { get; set; } = [];

    /// <summary>
    /// Optional resource ID, such as a feature flag or segment ID. Used to get audit logs for a specific resource.
    /// </summary>
    public string? RefId { get; set; }

    /// <summary>
    /// Optional user or access token ID. Omit to query logs from all creators.
    /// </summary>
    public Guid? CreatorId { get; set; }

    /// <summary>
    /// Optional text to search for in the log keyword or comment. Matching is case-insensitive.
    /// </summary>
    public string? Query { get; set; }

    /// <summary>
    /// Optional inclusive start time, expressed as Unix milliseconds. Omit for no lower time limit.
    /// </summary>
    public long? From { get; set; }

    /// <summary>
    /// Optional inclusive end time, expressed as Unix milliseconds. Must not precede from. Omit for no upper time limit.
    /// </summary>
    public long? To { get; set; }

    /// <summary>
    /// Only used to query audit logs for a specific shared segment across environments. Defaults to false.
    /// </summary>
    public bool? CrossEnvironment { get; set; }
}
