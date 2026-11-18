using System.Net;
using System.Text.Json;
using Application.Services;
using Domain.FeatureFlags;
using Domain.Targeting;
using Domain.Webhooks;
using Infrastructure.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace Infrastructure.UnitTests.Services;

public class WebhookSenderTests
{
    [Fact]
    public async Task OldDefaultTemplate_SendsSuccessfully()
    {
        // Relevant fragment of the old default template, including both custom helpers.
        const string template = """
            {
            {{#eq data.kind "feature flag"}}
              "fallthrough": {{json data.object.fallthrough}},
              "exptIncludeAllTargets": {{data.object.exptIncludeAllTargets}},
            {{/eq}}
              "event": "{{events}}"
            }
            """;
        var (delivery, handler) = await Send(template, Data());
        Assert.True(delivery.Success, JsonSerializer.Serialize(delivery.Error));
        using var json = JsonDocument.Parse(handler.Payload!);
        Assert.False(json.RootElement.GetProperty("exptIncludeAllTargets").GetBoolean());
        Assert.False(json.RootElement.GetProperty("fallthrough").TryGetProperty("includedInExpt", out _));
    }

    [Fact]
    public async Task LegacyDefaults_AreTypedAndDoNotLeakIntoNewTemplate()
    {
        const string template = """
            {
              "all": {{data.object.exptIncludeAllTargets}},
              "included": {{data.object.fallthrough.includedInExpt}},
              "rollout": {{data.object.fallthrough.variations.[0].exptRollout}},
              "rules": [{{#each data.object.rules}}
                {"included": {{includedInExpt}}, "rollout": {{variations.[0].exptRollout}} }
              {{/each}}],
              "branch": "{{#if data.object.exptIncludeAllTargets}}enabled{{else}}disabled{{/if}}"
            }
            """;
        var data = Data();
        var before = JsonSerializer.Serialize(data);
        var (legacyDelivery, legacyHandler) = await Send(template, data);
        Assert.True(legacyDelivery.Success, JsonSerializer.Serialize(legacyDelivery.Error));
        using var json = JsonDocument.Parse(legacyHandler.Payload!);
        var payload = json.RootElement;
        Assert.False(payload.GetProperty("all").GetBoolean());
        Assert.False(payload.GetProperty("included").GetBoolean());
        Assert.Equal(0, payload.GetProperty("rollout").GetInt32());
        Assert.False(payload.GetProperty("rules")[0].GetProperty("included").GetBoolean());
        Assert.Equal(0, payload.GetProperty("rules")[0].GetProperty("rollout").GetInt32());
        Assert.Equal("disabled", payload.GetProperty("branch").GetString());
        Assert.Equal(before, JsonSerializer.Serialize(data));

        var (delivery, handler) = await Send("{{json data.object}}", data);
        Assert.True(delivery.Success);
        Assert.DoesNotContain("exptIncludeAllTargets", handler.Payload);
        Assert.DoesNotContain("includedInExpt", handler.Payload);
        Assert.DoesNotContain("exptRollout", handler.Payload);
    }

    [Theory]
    [InlineData("{\"all\":{{data.object.exptIncludeAllTargets}},\"unknown\":{{data.object.unknownField}} }", "feature flag")]
    [InlineData("{\"value\":{{data.object.exptIncludeAllTargets}} }", "segment")]
    public async Task UnsupportedMissingFields_StillFailWithoutSending(string template, string kind)
    {
        var data = Data();
        ((Dictionary<string, object>)data["data"])["kind"] = kind;
        var (delivery, handler) = await Send(template, data);
        Assert.False(delivery.Success);
        Assert.Null(handler.Payload);
    }

    private static Dictionary<string, object> Data() => new()
    {
        ["events"] = "feature_flag.updated",
        ["data"] = new Dictionary<string, object>
        {
            ["kind"] = "feature flag",
            ["object"] = new Dictionary<string, object>
            {
                ["key"] = "flag",
                ["rules"] = new[] { new TargetRule { Variations = [new RolloutVariation { Id = "on", Rollout = [0, 1] }] } },
                ["fallthrough"] = new Fallthrough { Variations = [new RolloutVariation { Id = "on", Rollout = [0, 1] }] }
            }
        }
    };

    private static async Task<(WebhookDelivery, CaptureHandler)> Send(string template, Dictionary<string, object> data)
    {
        HandlebarsHelpers.RegisterHelpers();
        var handler = new CaptureHandler();
        using var client = new HttpClient(handler);
        var service = new Mock<IWebhookService>();
        var sender = new WebhookSender(client, service.Object, NullLogger<WebhookSender>.Instance);
        var webhook = new Webhook(Guid.NewGuid(), "test", [], "https://example.com/webhook", [], [],
            "custom", template, "", true, false, Guid.NewGuid());
        var result = await sender.SendAsync(webhook, data);
        Assert.Equal(template, webhook.PayloadTemplate);
        service.Verify(x => x.AddDeliveryAsync(It.IsAny<WebhookDelivery>()), Times.Once);
        return (result, handler);
    }

    private sealed class CaptureHandler : HttpMessageHandler
    {
        public string? Payload { get; private set; }
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Payload = await request.Content!.ReadAsStringAsync(cancellationToken);
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent("ok") };
        }
    }
}
