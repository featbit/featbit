namespace Domain.Members;

public class MemberGroup
{
    public string Id { get; set; }

    public string Name { get; set; }

    public string Description { get; set; }

    public string MemberId { get; set; }

    public bool IsGroupMember { get; set; }
}