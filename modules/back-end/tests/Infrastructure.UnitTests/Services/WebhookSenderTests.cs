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
    [Theory]
    [InlineData("{\"value\":{{data.object.exptIncludeAllTargets}} }", "{\"value\":false}")]
    [InlineData("{\"value\":{{data.object.fallthrough.includedInExpt}} }", "{\"value\":false}")]
    [InlineData("{\"value\":{{data.object.fallthrough.variations.[0].exptRollout}} }", "{\"value\":0}")]
    [InlineData("{{#each data.object.rules}}{\"included\":{{includedInExpt}},\"rollout\":{{variations.[0].exptRollout}} }{{/each}}", "{\"included\":false,\"rollout\":0}")]
    [InlineData("{\"value\":{{#if data.object.exptIncludeAllTargets}}true{{else}}false{{/if}} }", "{\"value\":false}")]
    public async Task OldTemplate_SendsTypedDefaultsWithoutMutatingSource(string template, string expected)
    {
        var data = Data();
        var before = JsonSerializer.Serialize(data);
        var (delivery, handler) = await Send(template, data);
        Assert.True(delivery.Success, JsonSerializer.Serialize(delivery));
        Assert.True(System.Text.Json.Nodes.JsonNode.DeepEquals(
            System.Text.Json.Nodes.JsonNode.Parse(expected), System.Text.Json.Nodes.JsonNode.Parse(handler.Payload!)));
        Assert.Equal(before, JsonSerializer.Serialize(data));
        Assert.DoesNotContain("exptIncludeAllTargets", before);
        Assert.DoesNotContain("includedInExpt", before);
        Assert.DoesNotContain("exptRollout", before);
    }

    [Fact]
    public async Task SavedOldDefaultTemplate_SendsSuccessfully()
    {
        // Exact default template from before experiment-field removal.
        const string template = """
            {
              "event": "{{events}}",
              "operator": "{{operator}}",
              "happenedAt": "{{happenedAt}}",
              "changes": {{json changes}},
              "organization": {
                "id": "{{organization.id}}",
                "name": "{{organization.name}}"
              },
              "project": {
                "id": "{{project.id}}",
                "name": "{{project.name}}"
              },
              "environment": {
                "id": "{{environment.id}}",
                "name": "{{environment.name}}"
              },
              "data": {
                "kind": "{{data.kind}}",
                "object": {
                  "id": "{{data.object.id}}",
                  "name": "{{data.object.name}}",
                  "description": "{{data.object.description}}",
                  "tags": {{json data.object.tags}},
            {{#eq data.kind "feature flag"}}
                  "key": "{{data.object.key}}",
                  "variationType": "{{data.object.variationType}}",
                  "variations": {{json data.object.variations}},
                  "targetUsers": {{json data.object.targetUsers}},
                  "rules": {{json data.object.rules}},
                  "isEnabled": {{data.object.isEnabled}},
                  "disabledVariationId": "{{data.object.disabledVariationId}}",
                  "fallthrough": {{json data.object.fallthrough}},
                  "exptIncludeAllTargets": {{data.object.exptIncludeAllTargets}},
            {{/eq}}
            {{#eq data.kind "segment"}}
                  "included": {{json data.object.included}},
                  "excluded": {{json data.object.excluded}},
                  "rules": {{json data.object.rules}},
                  "flagReferences": {{json data.object.flagReferences}},
            {{/eq}}
                  "isArchived": {{data.object.isArchived}}
                }
              }
            }
            """;
        var data = Data();
        var flag = (Dictionary<string, object>)((Dictionary<string, object>)data["data"])["object"];
        flag["isEnabled"] = "true";
        flag["isArchived"] = "false";
        flag["tags"] = Array.Empty<string>();
        flag["variations"] = Array.Empty<Variation>();
        flag["targetUsers"] = Array.Empty<object>();
        data["changes"] = Array.Empty<object>();
        var (delivery, handler) = await Send(template, data);
        Assert.True(delivery.Success, JsonSerializer.Serialize(delivery));
        using var json = JsonDocument.Parse(handler.Payload!);
        var payload = json.RootElement.GetProperty("data").GetProperty("object");
        Assert.False(payload.GetProperty("exptIncludeAllTargets").GetBoolean());
        Assert.False(payload.GetProperty("fallthrough").TryGetProperty("includedInExpt", out _));
        Assert.False(flag.ContainsKey("exptIncludeAllTargets"));
    }

    [Fact]
    public async Task NewTemplate_AfterOldTemplate_DoesNotEmitLegacyProperties()
    {
        var data = Data();
        await Send("{\"value\":{{data.object.exptIncludeAllTargets}} }", data);
        var (delivery, handler) = await Send("{{json data.object}}", data);
        Assert.True(delivery.Success);
        using var json = JsonDocument.Parse(handler.Payload!);
        Assert.Equal("flag", json.RootElement.GetProperty("key").GetString());
        Assert.DoesNotContain("exptIncludeAllTargets", handler.Payload);
        Assert.DoesNotContain("includedInExpt", handler.Payload);
        Assert.DoesNotContain("exptRollout", handler.Payload);
    }

    [Theory]
    [InlineData("{\"value\":{{data.object.unknownField}} }", "feature flag")]
    [InlineData("{\"value\":{{data.object.exptIncludeAllTargets}} }", "segment")]
    [InlineData("{\"value\":{{data.object.exptIncludeAllTargets}},}", "feature flag")]
    public async Task InvalidTemplates_StillFailWithoutSending(string template, string kind)
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
