namespace Application.Groups;

public class GroupMemberVm
{
    public Guid Id { get; set; }

    public string Email { get; set; }

    public bool IsGroupMember { get; set; }
}