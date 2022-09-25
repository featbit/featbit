using Domain.Policies;

namespace Application.Policies;

public class PolicyVm
{
    public string Id { get; set; }

    public string Name { get; set; }
        
    public string Type { get; set; }

    public string Description { get; set; }

    public IEnumerable<PolicyStatement> Statements { get; set; }

    public DateTime? UpdatedAt { get; set; }
}