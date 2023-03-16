using Application.Members;
using Domain.Policies;

namespace Application.AccessTokens;

public class AccessTokenVm
{
    public Guid Id { get; set; }

    public string Name { get; set; }
        
    public string Type { get; set; }
    
    public string Status { get; set; }
    public string Token { get; set; }
    public MemberVm Creator { get; set; }

    public IEnumerable<PolicyStatement> Permissions { get; set; }
    
    public DateTime? LastUsedAt { get; set; }
}