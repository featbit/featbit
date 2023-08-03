using Domain.FeatureFlags;

namespace Domain.SemanticPatch;

public class FeatureFlagSemanticPatch
{
    public ICollection<SemanticPatchInstruction> GetPatches(FeatureFlag flag1, FeatureFlag flag2)
    {
        var instructions = new List<SemanticPatchInstruction>();
        
        // Turn on or off the flag
        AddIsEnabledPatch(ref instructions, flag1, flag2);
        
        // Update settings
        AddNamePatch(ref instructions, flag1, flag2);
        AddDescriptionPatch(ref instructions, flag1, flag2);
        AddTagsPatch(ref instructions, flag1, flag2);
        
        
        
        return instructions;
    }

    public void ApplyPatches()
    {
        throw new NotImplementedException();
    }

    private void AddIsEnabledPatch(ref List<SemanticPatchInstruction> instructions, FeatureFlag flag1, FeatureFlag flag2)
    {
        if (flag1.IsEnabled != flag2.IsEnabled)
        {
            instructions.Add(flag2.IsEnabled
                ? SemanticPatchInstruction.TurnFlagOn()
                : SemanticPatchInstruction.TurnFlagOff());
        }
    }

    private void AddNamePatch(ref List<SemanticPatchInstruction> instructions, FeatureFlag flag1, FeatureFlag flag2)
    {
        if (!String.Equals(flag1.Name, flag2.Name))
        {
            instructions.Add(new SemanticPatchInstruction { Kind = FlagInstructionKind.UpdateName, Value = flag2.Name });
        }
    }
    
    private void AddDescriptionPatch(ref List<SemanticPatchInstruction> instructions, FeatureFlag flag1, FeatureFlag flag2)
    {
        if (!String.Equals(flag1.Description, flag2.Description))
        {
            instructions.Add(new SemanticPatchInstruction { Kind = FlagInstructionKind.UpdateDescription, Value = flag2.Description });
        }
    }
    
    private void AddTagsPatch(ref List<SemanticPatchInstruction> instructions, FeatureFlag flag1, FeatureFlag flag2)
    {
        var removedTags = flag1.Tags.Except(flag2.Tags);
        var addedTags = flag2.Tags.Except(flag1.Tags);

        if (removedTags.Any())
        {
            instructions.Add(new SemanticPatchInstruction
            {
                Kind = FlagInstructionKind.RemoveTags
            });
        }
        
        if (addedTags.Any())
        {
            instructions.Add(new SemanticPatchInstruction
            {
                Kind = FlagInstructionKind.AddTags
            });
        }
    }
}