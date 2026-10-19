using Application.Bases;
using Application.Bases.Exceptions;
using Application.FeatureFlags;
using Application.Services;
using Application.Users;
using Domain.FeatureFlags;
using Domain.SemanticPatch;
using MediatR;

namespace Application.UnitTests.Handlers;

public class UpdateInsightCollectionHandlerTests
{
    private readonly Mock<IFeatureFlagService> _flags = new();
    private readonly Mock<IPublisher> _publisher = new();
    private readonly Guid _userId = Guid.NewGuid();
    private readonly FeatureFlag _flag;
    private readonly UpdateInsightCollectionHandler _sut;

    public UpdateInsightCollectionHandlerTests()
    {
        var on = new Variation { Id = "on", Name = "On", Value = "true" };
        var off = new Variation { Id = "off", Name = "Off", Value = "false" };
        _flag = new FeatureFlag(Guid.NewGuid(), "Flag", "Description", "flag", true,
            VariationTypes.Boolean, [on, off], off.Id, on.Id, [], Guid.NewGuid());
        _flags.Setup(x => x.GetAsync(_flag.EnvId, _flag.Key)).ReturnsAsync(_flag);
        _flags.Setup(x => x.GetRunningExperimentsAsync(_flag.EnvId, _flag.Id)).ReturnsAsync([]);
        var user = new Mock<ICurrentUser>();
        user.SetupGet(x => x.Id).Returns(_userId);
        _sut = new UpdateInsightCollectionHandler(_flags.Object, user.Object, _publisher.Object);
    }

    private UpdateInsightCollection Request(bool enabled) => new()
    {
        EnvId = _flag.EnvId, Key = _flag.Key, Enabled = enabled, Comment = "Insights change"
    };

    [Fact]
    public async Task Handle_EnableInsights_UpdatesWithoutQueryingExperiments()
    {
        _flag.InsightsEnabled = false;
        var previousRevision = _flag.Revision;
        var request = Request(true);

        var revision = await _sut.Handle(request, CancellationToken.None);

        Assert.True(_flag.InsightsEnabled);
        Assert.NotEqual(previousRevision, revision);
        Assert.Equal(_flag.Revision, revision);
        _flags.Verify(x => x.GetRunningExperimentsAsync(It.IsAny<Guid>(), It.IsAny<Guid>()), Times.Never);
        AssertUpdatedAndPublished(request);
    }

    [Fact]
    public async Task Handle_DisableInsightsWithoutRunningExperiments_UpdatesAndPublishes()
    {
        var previousRevision = _flag.Revision;
        var request = Request(false);

        var revision = await _sut.Handle(request, CancellationToken.None);

        Assert.False(_flag.InsightsEnabled);
        Assert.NotEqual(previousRevision, revision);
        Assert.Equal(_flag.Revision, revision);
        _flags.Verify(x => x.GetRunningExperimentsAsync(_flag.EnvId, _flag.Id), Times.Once);
        AssertUpdatedAndPublished(request);
    }

    [Fact]
    public async Task Handle_DisableInsightsWithRunningExperiments_ThrowsWithoutChangingFlag()
    {
        _flags.Setup(x => x.GetRunningExperimentsAsync(_flag.EnvId, _flag.Id))
            .ReturnsAsync([new ExperimentReference(Guid.NewGuid(), "Experiment")]);
        var previousRevision = _flag.Revision;
        var previousUpdatedAt = _flag.UpdatedAt;
        var previousUpdatorId = _flag.UpdatorId;

        var exception = await Assert.ThrowsAsync<BusinessException>(
            () => _sut.Handle(Request(false), CancellationToken.None));

        Assert.Equal(ErrorCodes.BusinessRuleViolation, exception.Message);
        Assert.True(_flag.InsightsEnabled);
        Assert.Equal(previousRevision, _flag.Revision);
        Assert.Equal(previousUpdatedAt, _flag.UpdatedAt);
        Assert.Equal(previousUpdatorId, _flag.UpdatorId);
        _flags.Verify(x => x.GetRunningExperimentsAsync(_flag.EnvId, _flag.Id), Times.Once);
        AssertNotPersistedOrPublished();
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Handle_UnchangedState_ReturnsRevisionWithoutQueryingOrWriting(bool enabled)
    {
        _flag.InsightsEnabled = enabled;
        var previousRevision = _flag.Revision;
        var previousUpdatedAt = _flag.UpdatedAt;
        var previousUpdatorId = _flag.UpdatorId;

        var revision = await _sut.Handle(Request(enabled), CancellationToken.None);

        Assert.Equal(previousRevision, revision);
        Assert.Equal(previousRevision, _flag.Revision);
        Assert.Equal(enabled, _flag.InsightsEnabled);
        Assert.Equal(previousUpdatedAt, _flag.UpdatedAt);
        Assert.Equal(previousUpdatorId, _flag.UpdatorId);
        _flags.Verify(x => x.GetRunningExperimentsAsync(It.IsAny<Guid>(), It.IsAny<Guid>()), Times.Never);
        AssertNotPersistedOrPublished();
    }

    private void AssertUpdatedAndPublished(UpdateInsightCollection request)
    {
        Assert.Equal(_userId, _flag.UpdatorId);
        _flags.Verify(x => x.UpdateAsync(_flag), Times.Once);
        _publisher.Verify(x => x.Publish(It.IsAny<OnFeatureFlagChanged>(), It.IsAny<CancellationToken>()), Times.Once);
        var notification = Assert.IsType<OnFeatureFlagChanged>(_publisher.Invocations.Single().Arguments[0]);
        Assert.Single(FlagComparer.Compare(notification.DataChange), i => i.Kind == FlagInstructionKind.UpdateInsightsEnabled);
        Assert.Equal(request.Comment, notification.Comment);
        Assert.Equal(_userId, notification.OperatorId);
    }

    private void AssertNotPersistedOrPublished()
    {
        _flags.Verify(x => x.UpdateAsync(It.IsAny<FeatureFlag>()), Times.Never);
        _publisher.Verify(x => x.Publish(It.IsAny<OnFeatureFlagChanged>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
