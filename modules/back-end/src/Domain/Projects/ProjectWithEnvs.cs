using Environment = Domain.Environments.Environment;

namespace Domain.Projects;

public class ProjectWithEnvs
{
    public string Id { get; set; }

    public string Name { get; set; }
    
    public IEnumerable<Environment> Environments { get; set; }
}