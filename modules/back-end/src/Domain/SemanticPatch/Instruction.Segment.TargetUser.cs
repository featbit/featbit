using Domain.Segments;

namespace Domain.SemanticPatch;

public class SegmentTargetUserInstruction: SegmentInstruction
{
    public SegmentTargetUserInstruction(string kind, IEnumerable<string> value) : base(kind, value)
    {
    }

    public override void Apply(Segment segment)
    {
    }
}