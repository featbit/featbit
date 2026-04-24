namespace Domain.Targeting;

public class TargetUser
{
    /// <summary>
    /// The list of user keys explicitly targeted by the feature flag.
    /// </summary>
    public ICollection<string> KeyIds { get; set; }

    /// <summary>
    /// The variation ID associated with the targeted users.
    /// </summary>
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