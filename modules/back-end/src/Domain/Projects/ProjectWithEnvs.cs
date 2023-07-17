using Environment = Domain.Environments.Environment;

namespace Domain.Projects;

public class ProjectWithEnvs
{
    public Guid Id { get; set; }

    public string Name { get; set; }

    public string Key { get; set; }

    public IEnumerable<Environment> Environments { get; set; }
}