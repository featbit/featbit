namespace Application.Members;

public class MemberVm
{
    public string Id { get; set; }

    public string Email { get; set; }

    public string InvitorId { get; set; }

    public string InitialPassword { get; set; }

    public IEnumerable<MemberGroupVm> Groups { get; set; }
}