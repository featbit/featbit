using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Domain.EndUsers;
using Domain.Evaluation;
using Domain.Insights;
using Domain.Messages;
using Domain.Usages;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Application.IntegrationTests.Controllers;

[Collection(nameof(TestApp))]
[Trait("Category", "Host")]
public class InsightControllerTests(TestApp app)
{
    [Theory]
    [InlineData(Topics.EndUser)]
    [InlineData(Topics.Insights)]
    [InlineData(Topics.Usage)]
    public async Task TrackAsync_PartialPublishFailure_Returns503AndRetriesUser(string failedTopic)
    {
        var producer = new Mock<IMessageProducer>();
        var endUsers = new List<EndUserMessage[]>();
        var usages = new List<InsightUsage>();
        producer.Setup(x => x.PublishBatchAsync(Topics.EndUser, It.IsAny<IReadOnlyCollection<EndUserMessage>>()))
            .Callback<string, IReadOnlyCollection<EndUserMessage>>((_, users) => endUsers.Add(users.ToArray()))
            .Returns(Task.CompletedTask);
        producer.Setup(x => x.PublishAsync(Topics.Usage, It.IsAny<InsightUsage>()))
            .Callback<string, InsightUsage>((_, usage) => usages.Add(usage)).Returns(Task.CompletedTask);
        if (failedTopic == Topics.EndUser)
            producer.SetupSequence(x => x.PublishBatchAsync(Topics.EndUser, It.IsAny<IReadOnlyCollection<EndUserMessage>>()))
                .ThrowsAsync(new IOException("queue unavailable")).Returns(Task.CompletedTask).Returns(Task.CompletedTask);
        else if (failedTopic == Topics.Insights)
            producer.SetupSequence(x => x.PublishBatchAsync(Topics.Insights, It.IsAny<IReadOnlyCollection<InsightMessage>>()))
                .ThrowsAsync(new IOException("queue unavailable")).Returns(Task.CompletedTask).Returns(Task.CompletedTask);
        else
            producer.SetupSequence(x => x.PublishAsync(Topics.Usage, It.IsAny<InsightUsage>()))
                .ThrowsAsync(new IOException("queue unavailable")).Returns(Task.CompletedTask).Returns(Task.CompletedTask);
        using var factory = app.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            services.Replace(ServiceDescriptor.Singleton(producer.Object))));
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(TestData.ClientSecretString);
        var insights = new[] { UserVariationInsight("retry-user") };

        var failed = await client.PostAsJsonAsync("/api/public/insight/track", insights);
        var retry = await client.PostAsJsonAsync("/api/public/insight/track", insights);
        var duplicate = await client.PostAsJsonAsync("/api/public/insight/track", insights);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, failed.StatusCode);
        Assert.Equal(HttpStatusCode.OK, retry.StatusCode);
        Assert.Equal(HttpStatusCode.OK, duplicate.StatusCode);
        if (failedTopic != Topics.EndUser)
            Assert.Equal(new[] { 1, 1, 0 }, endUsers.Select(x => x.Length));
        else
            producer.Verify(x => x.PublishBatchAsync(Topics.EndUser,
                It.Is<IReadOnlyCollection<EndUserMessage>>(users => users.Count == 1)), Times.Exactly(2));
        if (failedTopic != Topics.Usage)
            Assert.Equal(new[] { 1, 1, 0 }, usages.Select(x => x.EndUsers.Count));
        else
            producer.Verify(x => x.PublishAsync(Topics.Usage,
                It.Is<InsightUsage>(usage => usage.EndUsers.Contains("retry-user"))), Times.Exactly(2));
    }

    [Fact]
    public async Task TrackAsync_ConcurrentSameUser_DoesNotDeduplicateUnconfirmedWrites()
    {
        var firstStarted = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var firstPublish = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var endUsers = new System.Collections.Concurrent.ConcurrentQueue<int>();
        var calls = 0;
        var producer = new Mock<IMessageProducer>();
        producer.Setup(x => x.PublishBatchAsync(Topics.EndUser, It.IsAny<IReadOnlyCollection<EndUserMessage>>()))
            .Returns((string _, IReadOnlyCollection<EndUserMessage> users) =>
            {
                endUsers.Enqueue(users.Count);
                if (Interlocked.Increment(ref calls) != 1)
                    return Task.CompletedTask;
                firstStarted.SetResult();
                return firstPublish.Task;
            });
        using var factory = app.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
            services.Replace(ServiceDescriptor.Singleton(producer.Object))));
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(TestData.ClientSecretString);
        var insights = new[] { UserVariationInsight("concurrent-user") };

        var first = client.PostAsJsonAsync("/api/public/insight/track", insights);
        await firstStarted.Task.WaitAsync(TimeSpan.FromSeconds(10));
        var second = await client.PostAsJsonAsync("/api/public/insight/track", insights);
        firstPublish.SetException(new IOException("queue unavailable"));
        var failed = await first;
        var retry = await client.PostAsJsonAsync("/api/public/insight/track", insights);

        Assert.Equal(HttpStatusCode.ServiceUnavailable, failed.StatusCode);
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        Assert.Equal(HttpStatusCode.OK, retry.StatusCode);
        Assert.Equal(new[] { 1, 1, 0 }, endUsers);
    }

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
        producer.Verify(p => p.PublishBatchAsync(Topics.EndUser, It.Is<IReadOnlyCollection<EndUserMessage>>(x => x.Count == 1)), Times.Once);
        producer.Verify(p => p.PublishBatchAsync(Topics.Insights, It.Is<IReadOnlyCollection<InsightMessage>>(x => x.Count == 1)), Times.Once);
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
        producer.Verify(p => p.PublishBatchAsync(Topics.EndUser, It.Is<IReadOnlyCollection<EndUserMessage>>(x => x.Count == 1)), Times.Once);
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
        producer.Verify(p => p.PublishBatchAsync(Topics.EndUser, It.Is<IReadOnlyCollection<EndUserMessage>>(x => x.Count == 2)), Times.Once);
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
        producer.Verify(p => p.PublishBatchAsync(Topics.EndUser, It.Is<IReadOnlyCollection<EndUserMessage>>(x => x.Count == 1)), Times.Once);
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
                    new MetricInsight { Type = "Custom", EventName = eventName, NumericValue = 1.0f }
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
