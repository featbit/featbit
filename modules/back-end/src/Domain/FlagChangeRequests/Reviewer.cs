namespace Domain.FlagChangeRequests;

public class Reviewer
{
    public Guid MemberId { get; set; }

    public string Action { get; set; }
    
    public DateTime? TimeStamp { get; set; }
}