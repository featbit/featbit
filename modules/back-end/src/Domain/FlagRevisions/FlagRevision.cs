using Domain.FeatureFlags;

namespace Domain.FlagRevisions;

public class FlagRevision : Entity
{
    public FeatureFlag Flag { get; set; }

    public string Comment { get; set; }

    public FlagRevision(FeatureFlag flag, string comment)
    {
        Flag = flag;
        Comment = comment;
    }
}