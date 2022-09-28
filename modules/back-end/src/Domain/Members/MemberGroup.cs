namespace Domain.Members;

public class MemberGroup
{
    public Guid Id { get; set; }

    public string Name { get; set; }

    public string Description { get; set; }

    public Guid MemberId { get; set; }

    public bool IsGroupMember { get; set; }
}