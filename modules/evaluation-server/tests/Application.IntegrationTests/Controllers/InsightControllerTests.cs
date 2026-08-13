using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Domain.EndUsers;
using Domain.Evaluation;
using Domain.Insights;
using Domain.Messages;
using Domain.Shared;
using Domain.Usages;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Application.IntegrationTests.Controllers;

[Collection(nameof(TestApp))]
public class InsightControllerTests(TestApp app)
{
    [Fact]
    public async Task TrackAsync_WithoutAuth_Returns401()
    {
        var producer = new Mock<IMessageProducer>();

        var result = await TrackAsync(producer.Object, [UserVariationInsight()], withAuth: false);

        Assert.Equal(HttpStatusCode.Unauthorized, result.StatusCode);
        producer.VerifyNoOtherCalls();
    }

    // --- Empty / all-invalid lists ---

    [Fact]
    public async Task TrackAsync_WithEmptyInsightList_ReturnsOkWithoutPublishing()
    {
        var producer = new Mock<IMessageProducer>();

        var result = await TrackAsync(producer.Object, []);

        Assert.Equal(HttpStatusCode.OK, result.StatusCode);
        producer.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task TrackAsync_WithAllInvalidInsights_ReturnsOkWithoutPublishing()
    {
        var producer = new Mock<IMessageProducer>();
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

        var result = await TrackAsync(producer.Object, insights);

        Assert.Equal(HttpStatusCode.OK, result.StatusCode);
        producer.VerifyNoOtherCalls();
    }

    // --- Valid insights ---

    [Fact]
    public async Task TrackAsync_WithValidInsight_ReturnsOkAndPublishesAllExpectedMessages()
    {
        var producer = new Mock<IMessageProducer>();
        var insights = new[] { UserVariationInsight() };

        var result = await TrackAsync(producer.Object, insights);

        Assert.Equal(HttpStatusCode.OK, result.StatusCode);
        producer.Verify(p => p.PublishAsync(Topics.EndUser, It.IsAny<EndUserMessage>()), Times.Once);
        producer.Verify(p => p.PublishAsync(Topics.Insights, It.IsAny<InsightMessage>()), Times.AtLeastOnce);
        producer.Verify(p => p.PublishAsync(Topics.Usage, It.IsAny<InsightUsage>()), Times.Once);
    }

    [Fact]
    public async Task TrackAsync_SameUserTwice_DeduplicatesEndUserMessage()
    {
        var producer = new Mock<IMessageProducer>();
        var insights = new[]
        {
            UserVariationInsight("user-1"),
            UserVariationInsight("user-1", "other-flag")
        };

        var result = await TrackAsync(producer.Object, insights);

        Assert.Equal(HttpStatusCode.OK, result.StatusCode);
        producer.Verify(p => p.PublishAsync(Topics.EndUser, It.IsAny<EndUserMessage>()), Times.Once);
    }

    [Fact]
    public async Task TrackAsync_TwoDistinctUsers_PublishesEndUserMessageForEach()
    {
        var producer = new Mock<IMessageProducer>();
        var insights = new[]
        {
            UserVariationInsight("user-1"),
            UserVariationInsight("user-2")
        };

        var result = await TrackAsync(producer.Object, insights);

        Assert.Equal(HttpStatusCode.OK, result.StatusCode);
        producer.Verify(p => p.PublishAsync(Topics.EndUser, It.IsAny<EndUserMessage>()), Times.Exactly(2));
    }

    [Fact]
    public async Task TrackAsync_MixedValidAndInvalidInsights_OnlyProcessesValidOnes()
    {
        var producer = new Mock<IMessageProducer>();
        var insights = new[]
        {
            UserVariationInsight("valid-user"),
            null!,
            new Insight { User = null },
            new Insight { User = new EndUser { KeyId = "" } }
        };

        var result = await TrackAsync(producer.Object, insights);

        Assert.Equal(HttpStatusCode.OK, result.StatusCode);
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

        var insights = new[]
        {
            new Insight
            {
                User = new EndUser { KeyId = "user-1" },
                Variations = new[]
                {
                    new VariationInsight
                    {
                        FeatureFlagKey = flagKey,
                        Variation = new Variation("550e8400-e29b-41d4-a716-446655440000", "true")
                    }
                }
            }
        };

        var result = await TrackAsync(producer.Object, insights);

        Assert.Equal(HttpStatusCode.OK, result.StatusCode);
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

        var insights = new[]
        {
            new Insight
            {
                User = new EndUser { KeyId = "user-1" },
                Variations = [],
                Metrics = new[]
                {
                    new MetricInsight { EventName = eventName, NumericValue = 1.0f }
                }
            }
        };

        var result = await TrackAsync(producer.Object, insights);

        Assert.Equal(HttpStatusCode.OK, result.StatusCode);
        producer.VerifyNoOtherCalls();
    }

    private async Task<HttpResponseMessage> TrackAsync(
        IMessageProducer producer,
        Insight[] insights,
        bool withAuth = true)
    {
        var trackApp = app.WithWebHostBuilder(builder =>
        {
            builder.ConfigureTestServices(services =>
            {
                services.Replace(ServiceDescriptor.Singleton<IMessageProducer>(producer));
            });
        });

        var client = trackApp.CreateClient();
        if (withAuth)
        {
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(TestData.ClientSecretString);
        }

        var response = await client.PostAsJsonAsync("/api/public/insight/track", insights);
        return response;
    }

    private static Insight UserVariationInsight(string userKey = "user-1", string flagKey = "my-flag") => new()
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