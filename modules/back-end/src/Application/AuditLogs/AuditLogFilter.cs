using Application.Bases.Models;

namespace Application.AuditLogs;

public class AuditLogFilter : PagedRequest
{
    public string Query { get; set; }

    public Guid? CreatorId { get; set; }

    public string RefId { get; set; }

    public string RefType { get; set; }

    public long? From { get; set; }

    public long? To { get; set; }

    public bool? CrossEnvironment { get; set; }
}