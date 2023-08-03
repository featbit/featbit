namespace Domain.SemanticPatch;

public class FlagInstructionKind
{
    public const string TurnFlagOn = nameof(TurnFlagOn);
    
    public const string TurnFlagOff = nameof(TurnFlagOff);

    public const string UpdateName = nameof(UpdateName);
    
    public const string UpdateDescription = nameof(UpdateDescription);
    
    public const string AddTags = nameof(AddTags);
    
    public const string RemoveTags = nameof(RemoveTags);

    public static readonly string[] All = { TurnFlagOn, TurnFlagOff, UpdateName, UpdateDescription, AddTags, RemoveTags };

    public static bool IsDefined(string type)
    {
        return All.Contains(type);
    }
}