using Domain.FeatureFlags;

namespace Domain.AuditLogs;

public class AuditLog : Entity
{
    public Guid EnvId { get; set; }

    public string RefId { get; set; }

    public string RefType { get; set; }

    public string Operation { get; set; }

    public DataChange DataChange { get; set; }

    public string Comment { get; set; }

    public Guid CreatorId { get; set; }

    public DateTime CreatedAt { get; set; }

    public AuditLog(
        Guid envId,
        string refId,
        string refType,
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

        EnvId = envId;

        RefId = refId;
        RefType = refType;
        Operation = operation;
        DataChange = dataChange;

        Comment = comment;
        CreatorId = creatorId;
        CreatedAt = DateTime.UtcNow;
    }

    public static AuditLog For(
        FeatureFlag flag,
        string operation,
        DataChange dataChange,
        string comment,
        Guid creatorId)
    {
        var auditLog = new AuditLog(
            flag.EnvId,
            flag.Id.ToString(),
            AuditLogRefTypes.FeatureFlag,
            operation,
            dataChange,
            comment,
            creatorId
        );

        return auditLog;
    }

    public static AuditLog ForUpdate(
        FeatureFlag flag,
        DataChange dataChange,
        string comment,
        Guid creatorId)
    {
        var auditLog = For(flag, Operations.Update, dataChange, comment, creatorId);

        return auditLog;
    }
}