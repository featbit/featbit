namespace Application.Policies;

public class PolicyMember
{
    public Guid Id { get; set; }
    public string Name { get; set; }
    public string Email { get; set; }
    public bool IsPolicyMember { get; set; }
}