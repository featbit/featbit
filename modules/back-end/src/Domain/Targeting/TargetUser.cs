namespace Domain.Targeting;

public class TargetUser
{
    public ICollection<string> KeyIds { get; set; }

    public string VariationId { get; set; }

    public static bool IsNullOrEmpty(TargetUser targetUser)
    {
        if (targetUser?.KeyIds == null)
        {
            return true;
        }

        return targetUser.KeyIds.Count == 0;
    }
}