using System.Linq.Expressions;
using Application.FeatureFlags;
using Application.Services;
using Application.Users;
using Domain.FeatureFlags;
using Domain.Resources;
using Domain.Segments;
using MediatR;

namespace Application.UnitTests.FeatureFlags;

public class CopyToEnvPrecheckHandlerTests
{
    [Fact]
    public async Task Handle_ForeignFlagIdInRequest_DoesNotInspectItsRulesOrProperties()
    {
        var sourceEnv = Guid.NewGuid();
        var targetEnv = Guid.NewGuid();
        var own = NewFlag(sourceEnv);
        var foreign = NewFlag(Guid.NewGuid());
        var flags = new Mock<IFeatureFlagService>();
        flags.Setup(x => x.FindManyAsync(It.IsAny<Expression<Func<FeatureFlag, bool>>>()))
            .Returns((Expression<Func<FeatureFlag, bool>> predicate) => Task.FromResult<ICollection<FeatureFlag>>(
                new[] { own, foreign }.Where(predicate.Compile()).ToArray()));
        flags.Setup(x => x.GetRelatedSegmentsAsync(It.IsAny<ICollection<FeatureFlag>>())).ReturnsAsync([]);
        var resources = new Mock<IResourceServiceV2>();
        resources.Setup(x => x.GetRNAsync(targetEnv, ResourceTypes.Env)).ReturnsAsync("organization/a:project/p:env/target");
        var sut = new CopyToEnvPrecheckHandler(flags.Object, Mock.Of<IEndUserService>(), resources.Object);

        var results = await sut.Handle(new CopyToEnvPrecheck
        {
            SourceEnvId = sourceEnv, TargetEnvId = targetEnv, FlagIds = [own.Id, foreign.Id]
        }, CancellationToken.None);

        Assert.Equal(own.Id, Assert.Single(results).Id);
        flags.Verify(x => x.GetRelatedSegmentsAsync(It.Is<ICollection<FeatureFlag>>(values =>
            values.Count == 1 && values.Single().Id == own.Id)), Times.Once);
    }

    private static FeatureFlag NewFlag(Guid env) => new(env, "Flag", "", "flag", true, VariationTypes.String,
        new List<Variation>
        {
            new() { Id = "on", Name = "On", Value = "on" },
            new() { Id = "off", Name = "Off", Value = "off" }
        }, "off", "on", [], Guid.NewGuid()) { Id = Guid.NewGuid() };
}
