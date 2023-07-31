using Domain.FeatureFlags;

namespace Domain.FlagRevisions;

public class FlagRevision : FullAuditedEntity
{
    public Guid EnvId { get; set; }
    
    public Guid FlagId { get; set; }
    
    public Guid Revision { get; set; }
    
    public string Comment { get; set; }
    
    public string Content { get; set; }

    public FlagRevision(
        Guid envId,
        Guid flagId,
        Guid revision,
        string comment,
        string content,
        Guid currentUserId) : base(currentUserId)
    {
        EnvId = envId;
        FlagId = flagId;
        Revision = revision;
        Comment = comment;
        Content = content;
    }

    public static FlagRevision FromFlag(FeatureFlag flag, string comment, Guid currentUserId)
    {
        return new FlagRevision(flag.EnvId, flag.Id, flag.Revision, comment, null, currentUserId);
    }
}