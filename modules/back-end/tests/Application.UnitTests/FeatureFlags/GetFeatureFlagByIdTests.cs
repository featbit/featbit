using System.Linq.Expressions;
using Application.Bases.Exceptions;
using Application.FeatureFlags;
using Application.Services;
using Domain.FeatureFlags;
using Moq;

namespace Application.UnitTests.FeatureFlags;

public class GetFeatureFlagByIdTests
{
    [Theory]
    [InlineData(true, true)]
    [InlineData(false, true)]
    [InlineData(true, false)]
    public async Task Lookup_RequiresBothEnvironmentAndId(bool sameEnvironment, bool sameId)
    {
        var flag = new FeatureFlag { Id = Guid.NewGuid(), EnvId = Guid.NewGuid() };
        var service = new Mock<IFeatureFlagService>();
        service.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<FeatureFlag, bool>>>()))
            .ReturnsAsync((Expression<Func<FeatureFlag, bool>> predicate) => predicate.Compile()(flag) ? flag : null);
        var handler = new GetFeatureFlagByIdHandler(service.Object);
        var request = new GetFeatureFlagById
        {
            EnvId = sameEnvironment ? flag.EnvId : Guid.NewGuid(),
            Id = sameId ? flag.Id : Guid.NewGuid()
        };

        if (sameEnvironment && sameId)
            Assert.Same(flag, await handler.Handle(request, CancellationToken.None));
        else
            await Assert.ThrowsAsync<EntityNotFoundException>(() => handler.Handle(request, CancellationToken.None));
    }
}
