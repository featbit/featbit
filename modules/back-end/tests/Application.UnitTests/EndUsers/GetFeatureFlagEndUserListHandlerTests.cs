using Application.Bases.Models;
using Application.EndUsers;
using Application.Services;
using Domain.FeatureFlags;

namespace Application.UnitTests.EndUsers;

public class GetFeatureFlagEndUserListHandlerTests
{
    [Fact]
    public async Task MapsVariationIdsAndPassesFilterToStatsService()
    {
        var envId = Guid.NewGuid();
        FeatureFlagEndUserParam? capturedParam = null;
        var featureFlagService = new Mock<IFeatureFlagService>();
        var statsService = new Mock<IFeatureFlagEndUserStatsService>();
        featureFlagService
            .Setup(x => x.GetAsync(envId, "checkout-onboarding"))
            .ReturnsAsync(new FeatureFlag
            {
                Variations =
                [
                    new Variation { Id = "control-id", Name = "Control", Value = "false" }
                ]
            });
        statsService
            .Setup(x => x.GetFeatureFlagEndUserStatsAsync(It.IsAny<FeatureFlagEndUserParam>()))
            .Callback<FeatureFlagEndUserParam>(param => capturedParam = param)
            .ReturnsAsync(new FeatureFlagEndUserStats
            {
                TotalCount = 2,
                Items =
                [
                    new FeatureFlagEndUser
                    {
                        VariationId = "control-id",
                        KeyId = "user-1",
                        Name = "User One",
                        LastEvaluatedAt = "2026-06-01T00:00:00.0000000Z"
                    },
                    new FeatureFlagEndUser
                    {
                        VariationId = "unknown-id",
                        KeyId = "user-2",
                        Name = "User Two",
                        LastEvaluatedAt = "2026-06-02T00:00:00.0000000Z"
                    }
                ]
            });
        var handler = new GetFeatureFlagEndUserListHandler(featureFlagService.Object, statsService.Object);

        PagedResult<FeatureFlagEndUserStatsVm> result = await handler.Handle(new GetFeatureFlagEndUserList
        {
            EnvId = envId,
            Filter = new FeatureFlagEndUserFilter
            {
                FeatureFlagKey = "checkout-onboarding",
                VariationId = "control-id",
                Query = "user",
                From = 1,
                To = 2,
                PageIndex = 3,
                PageSize = 10
            }
        }, CancellationToken.None);

        Assert.NotNull(capturedParam);
        Assert.Equal(envId, capturedParam.EnvId);
        Assert.Equal("checkout-onboarding", capturedParam.FeatureFlagKey);
        Assert.Equal("control-id", capturedParam.VariationId);
        Assert.Equal("user", capturedParam.Query);
        Assert.Equal(1, capturedParam.StartTime);
        Assert.Equal(2, capturedParam.EndTime);
        Assert.Equal(3, capturedParam.PageIndex);
        Assert.Equal(10, capturedParam.PageSize);
        Assert.Equal(2, result.TotalCount);
        Assert.Equal("Control", result.Items[0].Variation);
        Assert.Equal("unknown-id", result.Items[1].Variation);
    }
}
