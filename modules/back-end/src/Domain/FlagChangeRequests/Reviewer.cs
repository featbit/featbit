namespace Domain.FlagChangeRequests;

public class Reviewer
{
    public Guid MemberId { get; set; }

    public string Action { get; set; }
    
    public DateTime? Timestamp { get; set; }
}