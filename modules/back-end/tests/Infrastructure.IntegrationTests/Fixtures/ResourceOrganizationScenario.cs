using Domain.Organizations;
using Domain.Projects;
using Domain.Segments;
using Environment = Domain.Environments.Environment;

namespace Infrastructure.IntegrationTests.Fixtures;

internal sealed class ResourceOrganizationScenario
{
    public Organization FirstOrganization { get; }
    public Organization SecondOrganization { get; }
    public Project FirstProject { get; }
    public Project SecondProject { get; }
    public Environment FirstEnv { get; }
    public Environment SecondEnv { get; }
    public Segment SharedSegment { get; }

    public ResourceOrganizationScenario(bool sameWorkspace = false)
    {
        var workspace = Guid.NewGuid();
        FirstOrganization = new Organization(workspace, "First", "first-" + Guid.NewGuid().ToString("N")) { Id = Guid.NewGuid() };
        SecondOrganization = new Organization(sameWorkspace ? workspace : Guid.NewGuid(), "Second",
            "second-" + Guid.NewGuid().ToString("N")) { Id = Guid.NewGuid() };
        FirstProject = new Project(FirstOrganization.Id, "First", "shared") { Id = Guid.NewGuid() };
        SecondProject = new Project(SecondOrganization.Id, "Second", "shared") { Id = Guid.NewGuid() };
        FirstEnv = new Environment(FirstProject.Id, "Development", "dev");
        SecondEnv = new Environment(SecondProject.Id, "Development", "dev");
        SharedSegment = new Segment(workspace, Guid.Empty, "Shared", "shared", SegmentType.Shared,
            [$"organization/{FirstOrganization.Key}", $"organization/{SecondOrganization.Key}"],
            [], [], [], "") { Id = Guid.NewGuid() };
    }
}
