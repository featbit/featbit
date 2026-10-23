using Domain.FeatureFlags;
using Domain.Segments;

namespace Domain.AuditLogs;

public class AuditLog : Entity
{
    public Guid WorkspaceId { get; set; }

    public Guid? OrganizationId { get; set; }

    public Guid? EnvId { get; set; }

    public string RefId { get; set; }

    public string RefType { get; set; }

    public string Keyword { get; set; }

    public string Operation { get; set; }

    public DataChange DataChange { get; set; }

    public string Comment { get; set; }

    public Guid CreatorId { get; set; }

    public DateTime CreatedAt { get; set; }

    public AuditLog(
        Guid workspaceId,
        Guid? organizationId,
        Guid? envId,
        string refId,
        string refType,
        string keyword,
        string operation,
        DataChange dataChange,
        string comment,
        Guid creatorId)
    {
        if (!AuditLogRefTypes.IsDefined(refType))
        {
            throw new ArgumentOutOfRangeException(nameof(refType));
        }

        if (!Operations.IsDefined(operation))
        {
            throw new ArgumentOutOfRangeException(nameof(operation));
        }

        WorkspaceId = workspaceId;
        OrganizationId = organizationId;
        EnvId = envId;

        RefId = refId;
        RefType = refType;
        Keyword = keyword;
        Operation = operation;
        DataChange = dataChange;

        Comment = comment;
        CreatorId = creatorId;
        CreatedAt = DateTime.UtcNow;
    }

    public static AuditLog For(
        FeatureFlag flag,
        Guid workspaceId,
        Guid? organizationId,
        string operation,
        DataChange dataChange,
        string comment,
        Guid creatorId)
    {
        var auditLog = new AuditLog(
            workspaceId,
            organizationId,
            flag.EnvId,
            flag.Id.ToString(),
            AuditLogRefTypes.FeatureFlag,
            Keywords.For(flag),
            operation,
            dataChange,
            comment,
            creatorId
        );

        return auditLog;
    }

    public static AuditLog For(
        Segment segment,
        Guid workspaceId,
        Guid? organizationId,
        string operation,
        DataChange dataChange,
        string comment,
        Guid creatorId)
    {
        var auditLog = new AuditLog(
            workspaceId,
            segment.IsEnvironmentSpecific ? organizationId : null,
            segment.EnvId,
            segment.Id.ToString(),
            AuditLogRefTypes.Segment,
            Keywords.For(segment),
            operation,
            dataChange,
            comment,
            creatorId
        );

        return auditLog;
    }
}
