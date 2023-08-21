namespace Domain.SemanticPatch;

public abstract class Instruction
{
    public string Kind { get; set; }

    public object Value { get; set; }

    protected Instruction(string kind, object value)
    {
        Kind = kind ?? throw new ArgumentNullException(nameof(kind));
        Value = value ?? throw new ArgumentNullException(nameof(value));
    }
}