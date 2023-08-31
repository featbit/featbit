using Domain.Segments;

namespace Domain.SemanticPatch;

public class SegmentArchiveInstruction : SegmentInstruction
{
    public SegmentArchiveInstruction(string kind) : base(kind, string.Empty)
    {
    }

    public override void Apply(Segment segment)
    {
        segment.IsArchived = Kind == SegmentInstructionKind.Archive;
    }
}

public class SegmentNameInstruction : SegmentInstruction
{
    public SegmentNameInstruction(string value) : base(SegmentInstructionKind.UpdateName, value)
    {
    }

    public override void Apply(Segment segment)
    {
        if (Value is string name)
        {
            segment.Name = name;
        }
    }
}

public class SegmentDescriptionInstruction : SegmentInstruction
{
    public SegmentDescriptionInstruction(string value) : base(SegmentInstructionKind.UpdateDescription, value)
    {
    }

    public override void Apply(Segment segment)
    {
        if (Value is string description)
        {
            segment.Description = description;
        }
    }
}