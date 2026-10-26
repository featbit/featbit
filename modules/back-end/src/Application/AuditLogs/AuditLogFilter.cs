using Application.Bases.Models;

namespace Application.AuditLogs;

public class AuditLogFilter : PagedRequest
{
    /// <summary>
    /// The part of the keyword/comment of an audit log
    /// </summary>
    public string Query { get; set; }

    /// <summary>
    /// The creator id
    /// </summary>
    public Guid? CreatorId { get; set; }

    /// <summary>
    /// The referenced resource id, such as feature flag id or segment id
    /// </summary>
    public string RefId { get; set; }

    /// <summary>
    /// The referenced resource type. Can be one of the following: "FeatureFlag" or "Segment"
    /// </summary>
    public string RefType { get; set; }

    /// <summary>
    /// The start time of the audit log creation time range, in unix milliseconds
    /// </summary>
    public long? From { get; set; }

    /// <summary>
    /// The end time of the audit log creation time range, in unix milliseconds
    /// </summary>
    public long? To { get; set; }

    /// <summary>
    /// Whether to query logs across environments. By default, we only query logs in the specified environment (the current environment).
    /// Only set this to true if you want to query logs for a shared-segment.
    /// </summary>
    public bool? CrossEnvironment { get; set; }
}