using System.Diagnostics.Metrics;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Domain.EndUsers;
using Domain.Evaluation;
using Domain.Insights;
using Domain.Messages;
using Domain.Shared;
using Domain.Usages;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Diagnostics.Metrics.Testing;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Streaming.Insights;

namespace Application.IntegrationTests.Controllers;

public partial class InsightControllerTests
{
    private static Guid EnvId => TestData.ClientEnvId;

    [Fact]
    public async Task TrackAsync_MixedPayload_PublishesOnlyEnabledEvaluations()
    {
        var producer = new Mock<IMessageProducer>();
        var (client, _, _) = CreateFlagSettingClient(producer.Object, disabledKeys: ["off-flag"]);
        var insight = UserInsight("user-1", ["on-flag", "off-flag"]);

        var result = await PostAsync(client, [insight]);

        Assert.Equal(HttpStatusCode.OK, result.StatusCode);
        producer.Verify(p => p.PublishBatchAsync(Topics.EndUser, It.Is<IReadOnlyCollection<EndUserMessage>>(x => x.Count == 1)), Times.Once);
        producer.Verify(p => p.PublishBatchAsync(
            Topics.Insights,
            It.Is<IReadOnlyCollection<InsightMessage>>(x => x.Count == 1)), Times.Once);
        producer.Verify(p => p.PublishAsync(Topics.Usage, It.IsAny<InsightUsage>()), Times.Once);
    }

    [Fact]
    public async Task TrackAsync_AllEvaluationsDisabled_PublishesNothingAndCountsDrops()
    {
        var producer = new Mock<IMessageProducer>();
        var (client, _, meterFactory) = CreateFlagSettingClient(producer.Object, disabledKeys: ["off-flag"]);
        using var dropped = new MetricCollector<long>(meterFactory, InsightsMetrics.MeterName, InsightsMetrics.DroppedCounterName);

        var result = await PostAsync(client, [UserInsight("user-1", ["off-flag"]), UserInsight("user-2", ["off-flag"])]);

        Assert.Equal(HttpStatusCode.OK, result.StatusCode);
        producer.VerifyNoOtherCalls();
        var measurements = dropped.GetMeasurementSnapshot();
        Assert.Equal(2, measurements.Count);
        Assert.All(measurements, m =>
        {
            Assert.Equal("off-flag", m.Tags["flag_key"]);
            Assert.Equal(EnvId.ToString(), m.Tags["env_id"]);
            Assert.Equal(2, m.Tags.Count);
        });
    }

    [Fact]
    public async Task TrackAsync_UserFirstSeenOnlyWithDisabledFlags_IsRecordedOnLaterEnabledEvaluation()
    {
        var producer = new Mock<IMessageProducer>();
        var (client, _, _) = CreateFlagSettingClient(producer.Object, disabledKeys: ["off-flag"]);

        await PostAsync(client, [UserInsight("user-1", ["off-flag"])]);
        await PostAsync(client, [UserInsight("user-1", ["on-flag"])]);

        producer.Verify(p => p.PublishBatchAsync(
            Topics.EndUser,
            It.Is<IReadOnlyCollection<EndUserMessage>>(x => x.Count == 1)), Times.Once);
    }

    [Fact]
    public async Task TrackAsync_AllEvaluationsDisabledWithMetrics_PublishesEndUserAndMetricsOnly()
    {
        var producer = new Mock<IMessageProducer>();
        var (client, _, _) = CreateFlagSettingClient(producer.Object, disabledKeys: ["off-flag"]);
        var insight = UserInsight("user-1", ["off-flag"]);
        insight.Metrics = [new MetricInsight { Type = "Custom", EventName = "purchase", Timestamp = 1 }];

        await PostAsync(client, [insight]);

        producer.Verify(p => p.PublishBatchAsync(Topics.EndUser, It.Is<IReadOnlyCollection<EndUserMessage>>(x => x.Count == 1)), Times.Once);
        producer.Verify(p => p.PublishBatchAsync(
            Topics.Insights,
            It.Is<IReadOnlyCollection<InsightMessage>>(x => x.Count == 1)), Times.Once);
    }

    [Fact]
    public async Task TrackAsync_FlagDisabledAfterEvaluation_DropsOnReceipt()
    {
        var producer = new Mock<IMessageProducer>();
        var (client, cache, _) = CreateFlagSettingClient(producer.Object, disabledKeys: []);
        await PostAsync(client, [UserInsight("user-0", ["late-flag"])]);
        producer.Invocations.Clear();

        var evaluatedBeforeChange = UserInsight("user-1", ["late-flag"]);
        evaluatedBeforeChange.Variations![0]!.Timestamp = DateTimeOffset.UtcNow.AddMinutes(-5).ToUnixTimeMilliseconds();
        cache.Apply(FlagJson("late-flag", insightsEnabled: false));
        await PostAsync(client, [evaluatedBeforeChange]);

        producer.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task TrackAsync_FilteringSwitchedOff_PublishesDisabledFlagEvaluations()
    {
        var producer = new Mock<IMessageProducer>();
        var (client, _, _) = CreateFlagSettingClient(
            producer.Object, disabledKeys: ["off-flag"], filterByFlagSetting: false);

        await PostAsync(client, [UserInsight("user-1", ["off-flag"])]);

        producer.Verify(p => p.PublishBatchAsync(
            Topics.Insights,
            It.Is<IReadOnlyCollection<InsightMessage>>(x => x.Count == 1)), Times.Once);
    }

    [Fact]
    public async Task TrackAsync_UnknownFlag_IsPublishedAsBefore()
    {
        var producer = new Mock<IMessageProducer>();
        var (client, _, _) = CreateFlagSettingClient(producer.Object, disabledKeys: ["off-flag"]);

        await PostAsync(client, [UserInsight("user-1", ["never-seen-flag"])]);

        producer.Verify(p => p.PublishBatchAsync(
            Topics.Insights,
            It.Is<IReadOnlyCollection<InsightMessage>>(x => x.Count == 1)), Times.Once);
    }

    private (HttpClient Client, IInsightsSettingCache Cache, IMeterFactory MeterFactory) CreateFlagSettingClient(
        IMessageProducer producer,
        string[] disabledKeys,
        bool filterByFlagSetting = true)
    {
        var store = new Mock<IStore>();
        store
            .Setup(x => x.GetFlagsAsync(EnvId, 0))
            .ReturnsAsync(disabledKeys.Select(key => FlagBytes(key, insightsEnabled: false)).ToArray());
        var cache = new InsightsSettingCache(
            store.Object,
            Options.Create(new InsightsOptions()),
            TimeProvider.System,
            NullLogger<InsightsSettingCache>.Instance);

        WebApplicationFactory<Program> trackApp = app.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("Insights:FilterByFlagSetting", filterByFlagSetting.ToString());
            builder.ConfigureTestServices(services =>
            {
                services.Replace(ServiceDescriptor.Singleton(producer));
                services.Replace(ServiceDescriptor.Singleton<IInsightsSettingCache>(cache));
            });
        });

        var client = trackApp.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(TestData.ClientSecretString);

        return (client, cache, trackApp.Services.GetRequiredService<IMeterFactory>());
    }

    private static Task<HttpResponseMessage> PostAsync(HttpClient client, Insight[] insights) =>
        client.PostAsJsonAsync("/api/public/insight/track", insights);

    private static Insight UserInsight(string userKey, string[] flagKeys) => new()
    {
        User = new EndUser { KeyId = userKey, Name = "Test User" },
        Variations = flagKeys.Select(key => new VariationInsight
        {
            FeatureFlagKey = key,
            Variation = new Variation("550e8400-e29b-41d4-a716-446655440000", "true"),
            Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        }).ToArray<VariationInsight?>(),
        Metrics = []
    };

    private static byte[] FlagBytes(string key, bool insightsEnabled) =>
        Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new { envId = EnvId, key, insightsEnabled, isArchived = false }));

    private static JsonElement FlagJson(string key, bool insightsEnabled) =>
        JsonDocument.Parse(FlagBytes(key, insightsEnabled)).RootElement;
}
