using Domain.FeatureFlags;
using Domain.Targeting;

namespace Domain.SemanticPatch;

public class TargetUsersInstruction : FlagInstruction
{
    public TargetUsersInstruction(string kind, TargetUser value) : base(kind, value)
    {
    }

    public override void Apply(FeatureFlag flag)
    {
        if (Value is not TargetUser newTargetUser)
        {
            return;
        }

        switch (Kind)
        {
            case FlagInstructionKind.SetTargetUsers:
                SetTargetUsers();
                break;
            case FlagInstructionKind.AddTargetUsers:
                AddTargetUsers();
                break;
            case FlagInstructionKind.RemoveTargetUsers:
                RemoveTargetUsers();
                break;
        }

        return;

        void RemoveTargetUsers()
        {
            var targetUserForRemove = flag.TargetUsers.FirstOrDefault(x => x.VariationId == newTargetUser.VariationId);
            if (targetUserForRemove != null)
            {
                targetUserForRemove.KeyIds = targetUserForRemove.KeyIds.Except(newTargetUser.KeyIds).ToList();
            }
        }

        void AddTargetUsers()
        {
            var targetUserForAdd = flag.TargetUsers.FirstOrDefault(x => x.VariationId == newTargetUser.VariationId);
            if (targetUserForAdd != null)
            {
                targetUserForAdd.KeyIds = targetUserForAdd.KeyIds.Union(newTargetUser.KeyIds).ToList();
            }
            else
            {
                flag.TargetUsers.Add(newTargetUser);
            }
        }

        void SetTargetUsers()
        {
            var targetUserForSet = flag.TargetUsers.FirstOrDefault(x => x.VariationId == newTargetUser.VariationId);
            if (targetUserForSet != null)
            {
                targetUserForSet.KeyIds = newTargetUser.KeyIds;
            }
            else
            {
                flag.TargetUsers.Add(newTargetUser);
            }
        }
    }
}