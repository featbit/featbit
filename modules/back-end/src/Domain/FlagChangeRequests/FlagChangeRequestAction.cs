namespace Domain.FlagChangeRequests;

public class FlagChangeRequestAction
{
    public const string Empty = nameof(Empty);

    public const string Approve = nameof(Approve);

    public const string Decline = nameof(Decline);

    public static readonly string[] All = { Empty, Approve, Decline };

    public static bool IsDefined(string type)
    {
        return All.Contains(type);
    }
}