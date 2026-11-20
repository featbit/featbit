using System.Linq.Expressions;
using Application.FeatureFlags;
using Application.Services;
using Application.Users;
using Domain.FeatureFlags;
using Domain.Resources;
using Domain.Segments;
using MediatR;

namespace Application.UnitTests.FeatureFlags;

public class CopyToEnvHandlerTests
{
    [Fact]
    public async Task Handle_ForeignFlagIdInRequest_CopiesOnlyFlagsFromRouteEnvironment()
    {
        var sourceEnv = Guid.NewGuid();
        var targetEnv = Guid.NewGuid();
        var own = NewFlag(sourceEnv);
        var foreign = NewFlag(Guid.NewGuid());
        var flags = new Mock<IFeatureFlagService>();
        flags.Setup(x => x.FindManyAsync(It.IsAny<Expression<Func<FeatureFlag, bool>>>()))
            .Returns((Expression<Func<FeatureFlag, bool>> predicate) => Task.FromResult<ICollection<FeatureFlag>>(
                new[] { own, foreign }.Where(predicate.Compile()).ToArray()));
        var environments = new Mock<IEnvironmentService>();
        environments.Setup(x => x.GetProjectEnvAsync(sourceEnv)).ReturnsAsync("source");
        var publisher = new Mock<IPublisher>();
        var sut = new CopyToEnvHandler(flags.Object, Mock.Of<IEndUserService>(), environments.Object,
            Mock.Of<ICurrentUser>(), publisher.Object);
        var request = new CopyToEnv
        {
            SourceEnvId = sourceEnv, TargetEnvId = targetEnv, FlagIds = [own.Id, foreign.Id],
            PrecheckResults = new[] { own, foreign }.Select(x => new CopyToEnvPrecheckResult
                { Id = x.Id, KeyCheck = true, NewProperties = [] }).ToArray()
        };

        await sut.Handle(request, CancellationToken.None);

        flags.Verify(x => x.AddOneAsync(own), Times.Once);
        flags.Verify(x => x.AddOneAsync(foreign), Times.Never);
        Assert.Equal(targetEnv, own.EnvId);
        Assert.NotEqual(targetEnv, foreign.EnvId);
    }

    private static FeatureFlag NewFlag(Guid env) => new(env, "Flag", "", "flag", true, VariationTypes.String,
        new List<Variation>
        {
            new() { Id = "on", Name = "On", Value = "on" },
            new() { Id = "off", Name = "Off", Value = "off" }
        }, "off", "on", [], Guid.NewGuid()) { Id = Guid.NewGuid() };
}
