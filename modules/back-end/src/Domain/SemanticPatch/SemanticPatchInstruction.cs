namespace Domain.SemanticPatch;

public class SemanticPatchInstruction
{
    public string Kind { get; set; }

    public string Value { get; set; }

    public static SemanticPatchInstruction TurnFlagOn()
    {
        return new SemanticPatchInstruction { Kind = FlagInstructionKind.TurnFlagOn };
    }
    
    public static SemanticPatchInstruction TurnFlagOff()
    {
        return new SemanticPatchInstruction { Kind = FlagInstructionKind.TurnFlagOn };
    }
}