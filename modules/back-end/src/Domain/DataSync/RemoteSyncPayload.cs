using Domain.FeatureFlags;
using Domain.Segments;

namespace Domain.DataSync;

public class RemoteSyncPayload
{
    public IEnumerable<FeatureFlag> FeatureFlags { get; set; }

    public IEnumerable<Segment> Segments { get; set; }
}