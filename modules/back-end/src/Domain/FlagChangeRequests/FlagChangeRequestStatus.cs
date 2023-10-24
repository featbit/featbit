namespace Domain.FlagChangeRequests;

public class FlagChangeRequestStatus
{
    public const string Pending = nameof(Pending);
    
    public const string Approved = nameof(Approved);
    
    public const string Declined = nameof(Declined);

    public const string Applied = nameof(Applied);

    public static readonly string[] All = { Pending, Approved, Declined, Applied };

    public static bool IsDefined(string type)
    {
        return All.Contains(type);
    }
}