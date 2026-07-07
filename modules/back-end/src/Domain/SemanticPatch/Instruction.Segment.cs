using System.Text.Json.Serialization;
using Domain.Policies;
using Domain.Segments;

namespace Domain.SemanticPatch;

public abstract class SegmentInstruction : Instruction
{
    protected SegmentInstruction(string kind, object value) : base(kind, value)
    {
    }

    public abstract void Apply(Segment segment);

    [JsonIgnore]
    public string Permission
    {
        get
        {
            return Kind switch
            {
                SegmentInstructionKind.Archive => Permissions.ArchiveSegment,
                SegmentInstructionKind.Restore => Permissions.RestoreSegment,
                SegmentInstructionKind.UpdateName => Permissions.UpdateSegmentName,
                SegmentInstructionKind.UpdateDescription => Permissions.UpdateSegmentDescription,
                SegmentInstructionKind.AddTags or SegmentInstructionKind.RemoveTags => Permissions.UpdateSegmentTags,

                var kind when SegmentInstructionKind.UpdateTargetUsersKinds.Contains(kind) => Permissions.UpdateSegmentTargetingUsers,
                var kind when SegmentInstructionKind.UpdateRuleKinds.Contains(kind) => Permissions.UpdateSegmentRules,

                _ => string.Empty
            };
        }
    }
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