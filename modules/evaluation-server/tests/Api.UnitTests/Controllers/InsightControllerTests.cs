using Api.Public;
using Api.Setup;
using Domain.EndUsers;
using Domain.Evaluation;
using Domain.Insights;
using Domain.Messages;
using Domain.Shared;
using Domain.Usages;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Api.UnitTests.Controllers;

public class InsightControllerTests
{
    // --- Empty / all-invalid lists ---

    [Fact]
    public async Task TrackAsync_WithEmptyInsightList_ReturnsOkWithoutPublishing()
    {
        var producer = new Mock<IMessageProducer>();
        var controller = CreateController(producer.Object, TestData.ServerSecretString);

        var result = await controller.TrackAsync([]);

        Assert.IsType<OkResult>(result);
        producer.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task TrackAsync_WithAllInvalidInsights_ReturnsOkWithoutPublishing()
    {
        var producer = new Mock<IMessageProducer>();
        var controller = CreateController(producer.Object, TestData.ServerSecretString);

        var insights = new[]
        {
            new Insight { User = null },
            new Insight { User = new EndUser { KeyId = "" } },
            new Insight
            {
                User = new EndUser { KeyId = "user-1" },
                Variations = [new VariationInsight { FeatureFlagKey = "", Variation = new Variation("", "") }]
            }
        };

        var result = await controller.TrackAsync(insights);

        Assert.IsType<OkResult>(result);
        producer.VerifyNoOtherCalls();
    }

    // --- Valid insights ---

    [Fact]
    public async Task TrackAsync_WithValidInsight_ReturnsOkAndPublishesAllExpectedMessages()
    {
        var producer = new Mock<IMessageProducer>();
        var controller = CreateController(producer.Object, TestData.ServerSecretString);

        var result = await controller.TrackAsync([ValidInsight()]);

        Assert.IsType<OkResult>(result);
        producer.Verify(p => p.PublishAsync(Topics.EndUser, It.IsAny<EndUserMessage>()), Times.Once);
        producer.Verify(p => p.PublishAsync(Topics.Insights, It.IsAny<InsightMessage>()), Times.AtLeastOnce);
        producer.Verify(p => p.PublishAsync(Topics.Usage, It.IsAny<InsightUsage>()), Times.Once);
    }

    [Fact]
    public async Task TrackAsync_SameUserTwice_DeduplicatesEndUserMessage()
    {
        var producer = new Mock<IMessageProducer>();
        var controller = CreateController(producer.Object, TestData.ServerSecretString);

        var result = await controller.TrackAsync([ValidInsight("user-1"), ValidInsight("user-1", "other-flag")]);

        Assert.IsType<OkResult>(result);
        producer.Verify(p => p.PublishAsync(Topics.EndUser, It.IsAny<EndUserMessage>()), Times.Once);
    }

    [Fact]
    public async Task TrackAsync_TwoDistinctUsers_PublishesEndUserMessageForEach()
    {
        var producer = new Mock<IMessageProducer>();
        var controller = CreateController(producer.Object, TestData.ServerSecretString);

        var result = await controller.TrackAsync([ValidInsight("user-1"), ValidInsight("user-2")]);

        Assert.IsType<OkResult>(result);
        producer.Verify(p => p.PublishAsync(Topics.EndUser, It.IsAny<EndUserMessage>()), Times.Exactly(2));
    }

    [Fact]
    public async Task TrackAsync_MixedValidAndInvalidInsights_OnlyProcessesValidOnes()
    {
        var producer = new Mock<IMessageProducer>();
        var controller = CreateController(producer.Object, TestData.ServerSecretString);

        var insights = new[] { ValidInsight("valid-user"), new Insight { User = null } };

        var result = await controller.TrackAsync(insights);

        Assert.IsType<OkResult>(result);
        producer.Verify(p => p.PublishAsync(Topics.EndUser, It.IsAny<EndUserMessage>()), Times.Once);
    }

    // --- Malicious / bad data ---

    [Theory]
    [InlineData("'; DROP TABLE flags; --")] // SQL injection
    [InlineData("<script>alert(1)</script>")] // XSS
    [InlineData("../../etc/passwd")] // path traversal
    [InlineData("$(rm -rf /)")] // shell command injection
    [InlineData("flag\nkey")] // newline
    [InlineData("flag key")] // space (disallowed by regex)
    public async Task TrackAsync_WithMaliciousFlagKey_FiltersInsightWithoutPublishing(string flagKey)
    {
        var producer = new Mock<IMessageProducer>();
        var controller = CreateController(producer.Object, TestData.ServerSecretString);

        var insight = new Insight
        {
            User = new EndUser { KeyId = "user-1" },
            Variations =
            [
                new VariationInsight
                {
                    FeatureFlagKey = flagKey,
                    Variation = new Variation("550e8400-e29b-41d4-a716-446655440000", "true")
                }
            ]
        };

        var result = await controller.TrackAsync([insight]);

        Assert.IsType<OkResult>(result);
        producer.VerifyNoOtherCalls();
    }

    [Theory]
    [InlineData("'; DROP TABLE events; --")] // SQL injection
    [InlineData("<script>alert(1)</script>")] // XSS
    [InlineData("../../etc/passwd")] // path traversal
    [InlineData("event name")] // space (disallowed by regex)
    [InlineData("event\0name")] // null byte
    public async Task TrackAsync_WithMaliciousEventName_FiltersInsightWithoutPublishing(string eventName)
    {
        var producer = new Mock<IMessageProducer>();
        var controller = CreateController(producer.Object, TestData.ServerSecretString);

        var insight = new Insight
        {
            User = new EndUser { KeyId = "user-1" },
            Variations = [],
            Metrics = [new MetricInsight { EventName = eventName, NumericValue = 1.0f }]
        };

        var result = await controller.TrackAsync([insight]);

        Assert.IsType<OkResult>(result);
        producer.VerifyNoOtherCalls();
    }
    
    private static InsightController CreateController(IMessageProducer producer, string? authorizationHeader = null)
    {
        var controller = new InsightController(producer, new BoundedMemoryCache());
        var httpContext = new DefaultHttpContext();
        if (authorizationHeader is not null)
        {
            httpContext.Request.Headers.Authorization = authorizationHeader;
        }

        controller.ControllerContext = new ControllerContext { HttpContext = httpContext };

        return controller;
    }

    private static Insight ValidInsight(string userKey = "user-1", string flagKey = "my-flag") => new()
    {
        User = new EndUser { KeyId = userKey, Name = "Test User" },
        Variations =
        [
            new VariationInsight
            {
                FeatureFlagKey = flagKey,
                Variation = new Variation("550e8400-e29b-41d4-a716-446655440000", "true"),
                Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
            }
        ],
        Metrics = []
    };
}