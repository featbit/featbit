namespace Domain.Members;

public class Member
{
    public Guid Id { get; set; }

    public string Email { get; set; }

    public Guid? InvitorId { get; set; }

    public string InitialPassword { get; set; }

    public IEnumerable<MemberGroup> Groups { get; set; }
}