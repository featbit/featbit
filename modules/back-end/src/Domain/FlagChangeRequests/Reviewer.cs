namespace Domain.FlagChangeRequests;

public class Reviewer
{
    public Guid MemberId { get; set; }

    public string Action { get; set; }

    public DateTime? Timestamp { get; set; }

    // for ef core and System.Text.Json
    public Reviewer()
    {
    }

    public Reviewer(Guid memberId)
    {
        MemberId = memberId;
        Action = FlagChangeRequestAction.Empty;
        Timestamp = null;
    }
}