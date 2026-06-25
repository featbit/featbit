using Application.Organizations;
using Application.Projects;
using Application.Services;
using Domain.Organizations;
using Domain.Projects;
using MediatR;
using Environment = Domain.Environments.Environment;

namespace Application.UnitTests.Handlers;

public class OnboardingHandlerTests
{
    [Fact]
    public async Task Handle_InitializesOrganizationAndCreatesProjectWithEnvs()
    {
        var orgId = Guid.NewGuid();
        var org = new Organization(workspaceId: Guid.NewGuid(), name: "old", key: "old-key");
        var orgSvc = new Mock<IOrganizationService>();
        orgSvc.Setup(x => x.GetAsync(orgId)).ReturnsAsync(org);

        ProjectWithEnvs captured = null;
        var projectSvc = new Mock<IProjectService>();
        projectSvc.Setup(x => x.AddWithEnvsAsync(It.IsAny<Project>(), It.IsAny<IEnumerable<string>>()))
            .ReturnsAsync((Project p, IEnumerable<string> envs) =>
            {
                captured = new ProjectWithEnvs
                {
                    Id = p.Id,
                    Name = p.Name,
                    Key = p.Key,
                    Environments = envs.Select(n => new Environment(p.Id, n, n)).ToArray()
                };
                return captured;
            });

        var publisher = new Mock<IPublisher>();
        var sut = new OnboardingHandler(orgSvc.Object, projectSvc.Object, publisher.Object);

        var request = new Onboarding
        {
            OrganizationId = orgId,
            OrganizationName = "Acme",
            OrganizationKey = "acme",
            ProjectName = "Proj",
            ProjectKey = "proj",
            Environments = new[] { "Dev", "Prod" }
        };

        var result = await sut.Handle(request, CancellationToken.None);

        Assert.True(result);
        Assert.Equal("Acme", org.Name);
        Assert.Equal("acme", org.Key);
        Assert.True(org.Initialized);
        orgSvc.Verify(x => x.UpdateAsync(org), Times.Once);

        projectSvc.Verify(x => x.AddWithEnvsAsync(
            It.Is<Project>(p =>
                p.OrganizationId == org.Id &&
                p.Name == "Proj" &&
                p.Key == "proj"),
            It.Is<IEnumerable<string>>(e => e.SequenceEqual(new[] { "Dev", "Prod" }))),
            Times.Once);

        publisher.Verify(x => x.Publish(
            It.Is<OnProjectAdded>(n => n.ProjectWithEnvs == captured),
            It.IsAny<CancellationToken>()), Times.Once);
    }
}
