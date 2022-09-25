namespace Domain.Members;

public class Member
{
    public string Id { get; set; }

    public string Email { get; set; }

    public string InvitorId { get; set; }

    public string InitialPassword { get; set; }

    public IEnumerable<MemberGroup> Groups { get; set; }
}