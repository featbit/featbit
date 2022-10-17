using Domain.Environments;

namespace Application.Environments;

public class EnvironmentVm
{
    public string Id { get; set; }

    public string Name { get; set; }

    public string Description { get; set; }

    public ICollection<Secret> Secrets { get; set; }
}