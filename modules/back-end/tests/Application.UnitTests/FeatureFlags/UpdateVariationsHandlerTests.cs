using Application.FeatureFlags;
using Application.Services;
using Application.Users;
using Domain.FeatureFlags;
using Domain.Targeting;
using FluentValidation;
using MediatR;

namespace Application.UnitTests.FeatureFlags;

public class UpdateVariationsHandlerTests
{
    [Theory]
    [InlineData("disabled")]
    [InlineData("default")]
    [InlineData("user")]
    [InlineData("rule")]
    public async Task Handle_ReferencedVariationRemoved_RejectsBeforeMutationOrPublication(string reference)
    {
        var flag = NewFlag(reference);
        var revision = flag.Revision;
        var service = new Mock<IFeatureFlagService>();
        service.Setup(x => x.GetAsync(flag.EnvId, flag.Key)).ReturnsAsync(flag);
        var publisher = new Mock<IPublisher>(MockBehavior.Strict);
        var sut = new UpdateVariationsHandler(service.Object, Mock.Of<ICurrentUser>(), publisher.Object);
        var request = new UpdateVariations
        {
            EnvId = flag.EnvId, Key = flag.Key, Revision = revision,
            Variations = flag.Variations.Where(x => x.Id != "extra").ToList()
        };

        await Assert.ThrowsAsync<ValidationException>(() => sut.Handle(request, CancellationToken.None));

        Assert.Contains(flag.Variations, x => x.Id == "extra");
        Assert.Equal(revision, flag.Revision);
        service.Verify(x => x.UpdateAsync(It.IsAny<FeatureFlag>()), Times.Never);
        publisher.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task Handle_UnreferencedVariationRemoved_PersistsAndPublishes()
    {
        var flag = NewFlag("unused");
        var service = new Mock<IFeatureFlagService>();
        service.Setup(x => x.GetAsync(flag.EnvId, flag.Key)).ReturnsAsync(flag);
        var publisher = new Mock<IPublisher>();
        var sut = new UpdateVariationsHandler(service.Object, Mock.Of<ICurrentUser>(), publisher.Object);

        await sut.Handle(new UpdateVariations
        {
            EnvId = flag.EnvId, Key = flag.Key, Revision = flag.Revision,
            Variations = flag.Variations.Where(x => x.Id != "extra").ToList()
        }, CancellationToken.None);

        Assert.DoesNotContain(flag.Variations, x => x.Id == "extra");
        service.Verify(x => x.UpdateAsync(flag), Times.Once);
        publisher.Verify(x => x.Publish(It.IsAny<OnFeatureFlagChanged>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    private static FeatureFlag NewFlag(string reference)
    {
        var flag = new FeatureFlag(Guid.NewGuid(), "Flag", "", "flag", true, VariationTypes.String,
            new List<Variation>
            {
                new() { Id = "on", Name = "On", Value = "on" },
                new() { Id = "off", Name = "Off", Value = "off" },
                new() { Id = "extra", Name = "Extra", Value = "extra" }
            }, "off", "on", [], Guid.NewGuid());
        if (reference == "disabled") flag.DisabledVariationId = "extra";
        if (reference == "default") flag.Fallthrough.Variations.Single().Id = "extra";
        if (reference == "user") flag.TargetUsers = [new TargetUser { KeyIds = ["user"], VariationId = "extra" }];
        if (reference == "rule") flag.Rules = [new TargetRule
        {
            Id = "rule", Name = "Rule",
            Conditions = [new Condition { Id = "condition", Property = "country", Op = OperatorTypes.Equal, Value = "UK" }],
            Variations = [new RolloutVariation { Id = "extra", Rollout = [0, 1] }]
        }];
        return flag;
    }
}
