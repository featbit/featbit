namespace Domain.FlagChangeRequests;

public class Reviewer
{
    public Guid MemberId { get; set; }

    public string Action { get; set; }

    public DateTime? Timestamp { get; set; }

    public Reviewer(Guid memberId)
    {
        MemberId = memberId;
        Action = FlagChangeRequestAction.Empty;
        Timestamp = null;
    }
}