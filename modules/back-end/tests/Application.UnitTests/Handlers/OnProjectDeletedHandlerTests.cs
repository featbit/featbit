using System.Linq.Expressions;
using Application.Projects;
using Application.Services;
using Domain.Policies;
using Domain.Projects;
using MediatR;

namespace Application.UnitTests.Handlers;

public class OnProjectDeletedHandlerTests
{
    [Fact]
    public async Task Handle_RemovesTheGeneratedCreatorAccessPolicy()
    {
        var projectId = Guid.NewGuid();
        var policy = new Policy(
            Guid.NewGuid(),
            "Creator access",
            ProjectCreatorAccess.PolicyKey(projectId),
            ""
        )
        {
            Id = Guid.NewGuid()
        };
        var publisher = new Mock<IPublisher>();
        var policyService = new Mock<IPolicyService>();
        policyService
            .Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<Policy, bool>>>()))
            .ReturnsAsync((Expression<Func<Policy, bool>> predicate) =>
                predicate.Compile()(policy) ? policy : null);
        policyService.Setup(x => x.DeleteAsync(policy.Id)).Returns(Task.CompletedTask);
        var sut = new OnProjectDeletedHandler(publisher.Object, policyService.Object);

        await sut.Handle(new OnProjectDeleted(new ProjectWithEnvs
        {
            Id = projectId,
            Name = "My project",
            Key = "my-project",
            Environments = []
        }), CancellationToken.None);

        policyService.Verify(x => x.DeleteAsync(policy.Id), Times.Once);
    }
}
