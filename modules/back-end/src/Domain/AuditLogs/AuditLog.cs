using Domain.FeatureFlags;
using Domain.Segments;

namespace Domain.AuditLogs;

public class AuditLog : Entity
{
    public Guid EnvId { get; set; }

    public string RefId { get; set; }

    public string RefType { get; set; }

    public string Keyword { get; set; }

    public string Operation { get; set; }

    public DataChange DataChange { get; set; }

    public string Comment { get; set; }

    public Guid CreatorId { get; set; }

    public DateTime CreatedAt { get; set; }

    public AuditLog(
        Guid envId,
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

    #region feature flag

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
            Keywords.For(flag),
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

    public static AuditLog ForCreate(FeatureFlag flag, Guid creatorId)
    {
        var dataChange = new DataChange(null).To(flag);

        var auditLog = For(flag, Operations.Create, dataChange, string.Empty, creatorId);
        return auditLog;
    }

    public static AuditLog ForArchive(FeatureFlag flag, DataChange dataChange, Guid operatorId)
    {
        var auditLog = For(flag, Operations.Archive, dataChange, string.Empty, operatorId);

        return auditLog;
    }

    public static AuditLog ForRestore(FeatureFlag flag, DataChange dataChange, Guid operatorId)
    {
        var auditLog = For(flag, Operations.Restore, dataChange, string.Empty, operatorId);

        return auditLog;
    }

    public static AuditLog ForRemove(FeatureFlag flag, Guid operatorId)
    {
        var dataChange = new DataChange(flag).To(null);

        var auditLog = For(flag, Operations.Remove, dataChange, string.Empty, operatorId);

        return auditLog;
    }

    #endregion

    #region segment

    public static AuditLog For(
        Segment segment,
        string operation,
        DataChange dataChange,
        string comment,
        Guid creatorId)
    {
        var auditLog = new AuditLog(
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

    public static AuditLog ForCreate(Segment segment, Guid creatorId)
    {
        var dataChange = new DataChange(null).To(segment);

        var auditLog = For(segment, Operations.Create, dataChange, string.Empty, creatorId);
        return auditLog;
    }

    public static AuditLog ForUpdate(
        Segment segment,
        DataChange dataChange,
        string comment,
        Guid creatorId)
    {
        var auditLog = For(segment, Operations.Update, dataChange, comment, creatorId);

        return auditLog;
    }

    public static AuditLog ForArchive(Segment segment, DataChange dataChange, Guid operatorId)
    {
        var auditLog = For(segment, Operations.Archive, dataChange, string.Empty, operatorId);

        return auditLog;
    }

    #endregion
}