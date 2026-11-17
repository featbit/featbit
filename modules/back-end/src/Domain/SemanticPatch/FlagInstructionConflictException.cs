namespace Domain.SemanticPatch;

/// <summary>
/// Indicates that a flag instruction conflicts with the flag's current state.
/// </summary>
public class FlagInstructionConflictException(string instructionKind, string message)
    : InvalidOperationException(message)
{
    public string InstructionKind { get; } = instructionKind;
}
