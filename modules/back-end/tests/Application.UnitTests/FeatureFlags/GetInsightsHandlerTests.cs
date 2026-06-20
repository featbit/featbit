using Application.FeatureFlags;
using Application.Services;
using Domain.FeatureFlags;

namespace Application.UnitTests.FeatureFlags;

public class GetInsightsHandlerTests
{
    [Fact]
    public async Task MapsVariationIdsToVariationNamesAndFillsMissingCounts()
    {
        var envId = Guid.NewGuid();
        var featureFlagService = new Mock<IFeatureFlagService>();
        var insightsService = new Mock<IFeatureFlagInsightsService>();
        featureFlagService
            .Setup(x => x.GetAsync(envId, "checkout-onboarding"))
            .ReturnsAsync(new FeatureFlag
            {
                Variations =
                [
                    new Variation { Id = "control-id", Name = "Control", Value = "false" },
                    new Variation { Id = "treatment-id", Name = "Treatment", Value = "true" }
                ]
            });
        insightsService
            .Setup(x => x.GetFeatureFlagInsightsAsync(envId, It.IsAny<StatsByVariationFilter>()))
            .ReturnsAsync(
            [
                new Domain.FeatureFlags.Insights
                {
                    Time = "2026-06-01T00:00:00.0000000Z",
                    Variations =
                    [
                        new VariationInsights { Id = "treatment-id", Val = 12 }
                    ]
                }
            ]);
        var handler = new GetInsightsHandler(featureFlagService.Object, insightsService.Object);

        var result = (await handler.Handle(new GetInsights
        {
            EnvId = envId,
            Filter = new StatsByVariationFilter
            {
                FeatureFlagKey = "checkout-onboarding",
                IntervalType = IntervalType.Day,
                From = 1,
                To = 2
            }
        }, CancellationToken.None)).ToArray();

        Assert.Single(result);
        Assert.Equal("Control", result[0].Variations.ElementAt(0).Variation);
        Assert.Equal(0, result[0].Variations.ElementAt(0).Count);
        Assert.Equal("Treatment", result[0].Variations.ElementAt(1).Variation);
        Assert.Equal(12, result[0].Variations.ElementAt(1).Count);
    }
}
