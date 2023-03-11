using Domain.Policies;

namespace Application.AccessTokens;

public class AccessTokenVm
{
    public string Id { get; set; }

    public string Name { get; set; }
        
    public string Type { get; set; }

    public IEnumerable<Guid> PolicyIds { get; set; }
}