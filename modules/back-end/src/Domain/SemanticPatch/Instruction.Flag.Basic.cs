using Domain.FeatureFlags;

namespace Domain.SemanticPatch;

public class StatusInstruction : FlagInstruction
{
    public StatusInstruction(string kind) : base(kind, string.Empty)
    {
    }

    public override void Apply(FeatureFlag flag)
    {
        flag.IsEnabled = Kind == FlagInstructionKind.TurnFlagOn;
    }
}

public class ArchiveInstruction : FlagInstruction
{
    public ArchiveInstruction(string kind) : base(kind, string.Empty)
    {
    }

    public override void Apply(FeatureFlag flag)
    {
        flag.IsArchived = Kind == FlagInstructionKind.ArchiveFlag;
    }
}

public class NameInstruction : FlagInstruction
{
    public NameInstruction(string value) : base(FlagInstructionKind.UpdateName, value)
    {
    }

    public override void Apply(FeatureFlag flag)
    {
        if (Value is string name)
        {
            flag.Name = name;
        }
    }
}

public class DescriptionInstruction : FlagInstruction
{
    public DescriptionInstruction(string value) : base(FlagInstructionKind.UpdateDescription, value)
    {
    }

    public override void Apply(FeatureFlag flag)
    {
        if (Value is string description)
        {
            flag.Description = description;
        }
    }
}

public class TagsInstruction : FlagInstruction
{
    public TagsInstruction(string kind, ICollection<string> value) : base(kind, value)
    {
    }

    public override void Apply(FeatureFlag flag)
    {
        if (Value is not ICollection<string> tags)
        {
            return;
        }

        flag.Tags = Kind switch
        {
            FlagInstructionKind.AddTags => flag.Tags.Union(tags).ToList(),
            FlagInstructionKind.RemoveTags => flag.Tags.Except(tags).ToList(),
            _ => flag.Tags
        };
    }
}