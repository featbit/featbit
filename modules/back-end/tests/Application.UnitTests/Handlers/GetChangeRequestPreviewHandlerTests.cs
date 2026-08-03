using System.Linq.Expressions;
using Application.ChangeRequests;
using Application.Services;
using Domain.FeatureFlags;
using Domain.FlagChangeRequests;
using Domain.FlagDrafts;
using Domain.Targeting;

namespace Application.UnitTests.Handlers;

public class GetChangeRequestPreviewHandlerTests
{
    [Fact]
    public async Task Handle_AppliesTheDraftToACloneOfTheCurrentFlag()
    {
        var orgId = Guid.NewGuid();
        var envId = Guid.NewGuid();
        var flagId = Guid.NewGuid();
        var draftId = Guid.NewGuid();
        var requestId = Guid.NewGuid();
        var creatorId = Guid.NewGuid();
        var currentFlag = CreateFlag(envId, flagId, creatorId);
        currentFlag.IsEnabled = false;
        var draftSource = CreateFlag(envId, flagId, creatorId);
        var dataChange = draftSource.UpdateTargeting(
            new FlagTargeting
            {
                DisabledVariationId = "on",
                TargetUsers =
                [
                    new TargetUser
                    {
                        VariationId = "on",
                        KeyIds = ["user-1"]
                    }
                ],
                Rules = [],
                Fallthrough = new Fallthrough
                {
                    DispatchKey = "keyId",
                    Variations =
                    [
                        new RolloutVariation
                        {
                            Id = "off",
                            Rollout = [0, 1]
                        }
                    ]
                },
                ExptIncludeAllTargets = false
            },
            creatorId);
        var draft = new FlagDraft(envId, flagId, dataChange, creatorId)
        {
            Id = draftId
        };
        var changeRequest = new FlagChangeRequest(
            orgId,
            envId,
            draftId,
            flagId,
            [Guid.NewGuid()],
            creatorId,
            reason: "Increase checkout exposure")
        {
            Id = requestId
        };

        var changeRequestService = new Mock<IFlagChangeRequestService>();
        changeRequestService
            .Setup(service => service.FindOneAsync(
                It.IsAny<Expression<Func<FlagChangeRequest, bool>>>()))
            .ReturnsAsync(changeRequest);
        var draftService = new Mock<IFlagDraftService>();
        draftService
            .Setup(service => service.FindOneAsync(
                It.IsAny<Expression<Func<FlagDraft, bool>>>()))
            .ReturnsAsync(draft);
        var flagService = new Mock<IFeatureFlagService>();
        flagService
            .Setup(service => service.FindOneAsync(
                It.IsAny<Expression<Func<FeatureFlag, bool>>>()))
            .ReturnsAsync(currentFlag);
        var handler = new GetChangeRequestPreviewHandler(
            changeRequestService.Object,
            draftService.Object,
            flagService.Object);

        var result = await handler.Handle(
            new GetChangeRequestPreview
            {
                OrgId = orgId,
                EnvId = envId,
                Id = requestId
            },
            CancellationToken.None);

        Assert.Equal(requestId, result.Id);
        Assert.Equal("Increase checkout exposure", result.Reason);
        Assert.Equal(FlagChangeRequestStatus.PendingReview, result.Status);
        Assert.NotSame(currentFlag, result.Flag);
        Assert.False(result.Flag.IsEnabled);
        Assert.Equal("on", result.Flag.DisabledVariationId);
        Assert.Equal(["user-1"], Assert.Single(result.Flag.TargetUsers).KeyIds);
        Assert.Equal("off", Assert.Single(result.Flag.Fallthrough.Variations).Id);
        Assert.Equal("off", currentFlag.DisabledVariationId);
        Assert.Empty(currentFlag.TargetUsers);
    }

    private static FeatureFlag CreateFlag(Guid envId, Guid flagId, Guid creatorId)
    {
        var flag = new FeatureFlag(
            envId,
            "Checkout V2",
            "",
            "checkout-v2",
            true,
            "boolean",
            [
                new Variation { Id = "on", Name = "On", Value = "true" },
                new Variation { Id = "off", Name = "Off", Value = "false" }
            ],
            "off",
            "on",
            [],
            creatorId)
        {
            Id = flagId
        };

        return flag;
    }
}
