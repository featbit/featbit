using Domain.Segments;

namespace Domain.SemanticPatch;

public abstract class SegmentInstruction : Instruction
{
    protected SegmentInstruction(string kind, object value) : base(kind, value)
    {
    }

    public abstract void Apply(Segment segment);
}

public class NoopSegmentInstruction : SegmentInstruction
{
    public NoopSegmentInstruction() : base(FlagInstructionKind.Noop, string.Empty)
    {
    }

    public override void Apply(Segment segment)
    {
    }

    public static readonly NoopSegmentInstruction Instance = new();
}