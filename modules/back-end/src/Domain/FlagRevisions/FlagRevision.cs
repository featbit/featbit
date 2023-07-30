using Domain.FeatureFlags;

namespace Domain.FlagRevisions;

public class FlagRevision : FullAuditedEntity
{
    public Guid EnvId { get; set; }
    
    public Guid FlagId { get; set; }
    
    public int Version { get; set; }
    
    public string Comment { get; set; }
    
    public string Content { get; set; }

    public FlagRevision(
        Guid envId,
        Guid flagId,
        int version,
        string comment,
        string content,
        Guid currentUserId) : base(currentUserId)
    {
        EnvId = envId;
        FlagId = flagId;
        Version = version;
        Comment = comment;
        Content = content;
    }

    public static FlagRevision FromFlag(FeatureFlag flag, string comment, Guid currentUserId)
    {
        return new FlagRevision(flag.EnvId, flag.Id, 0, comment, null, currentUserId);
    }
}