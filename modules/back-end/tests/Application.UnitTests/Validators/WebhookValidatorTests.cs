using Application.Bases;
using Application.Webhooks;
using Domain.Webhooks;

namespace Application.UnitTests.Validators;

public class WebhookValidatorTests
{
    private static WebhookBase Valid() => new()
    {
        Name = "wh",
        Url = "https://example.com",
        Scopes = new[] { "scope" },
        Events = new[] { WebhookEvents.FlagEvents.Created },
        PayloadTemplateType = PayloadTemplateType.Default,
        PayloadTemplate = "{}"
    };

    [Fact]
    public void WebhookBase_AllValid_NoErrors()
    {
        var result = new WebhookBaseValidator().Validate(Valid());

        Assert.True(result.IsValid);
    }

    [Theory]
    [InlineData(nameof(WebhookBase.Name), "name")]
    [InlineData(nameof(WebhookBase.Url), "url")]
    [InlineData(nameof(WebhookBase.PayloadTemplate), "payloadTemplate")]
    public void WebhookBase_MissingStringField_RequiredError(string property, string code)
    {
        var wh = Valid();
        switch (property)
        {
            case nameof(WebhookBase.Name): wh.Name = string.Empty; break;
            case nameof(WebhookBase.Url): wh.Url = string.Empty; break;
            case nameof(WebhookBase.PayloadTemplate): wh.PayloadTemplate = string.Empty; break;
        }

        var result = new WebhookBaseValidator().Validate(wh);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Required(code));
    }

    [Fact]
    public void WebhookBase_EmptyScopes_ScopesRequiredError()
    {
        var wh = Valid();
        wh.Scopes = Array.Empty<string>();

        var result = new WebhookBaseValidator().Validate(wh);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Required("scopes"));
    }

    [Fact]
    public void WebhookBase_EmptyEvents_EventsRequiredError()
    {
        var wh = Valid();
        wh.Events = Array.Empty<string>();

        var result = new WebhookBaseValidator().Validate(wh);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Required("events"));
    }

    [Fact]
    public void WebhookBase_UnknownEvent_EventsInvalidError()
    {
        var wh = Valid();
        wh.Events = new[] { "made.up.event" };

        var result = new WebhookBaseValidator().Validate(wh);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("events"));
    }

    [Fact]
    public void WebhookBase_UnknownPayloadTemplateType_PayloadTemplateTypeInvalidError()
    {
        var wh = Valid();
        wh.PayloadTemplateType = "weird";

        var result = new WebhookBaseValidator().Validate(wh);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("payloadTemplateType"));
    }

    [Fact]
    public void CreateWebhook_DelegatesToBaseValidator()
    {
        var request = new CreateWebhook
        {
            Name = "wh",
            Url = "",
            Scopes = new[] { "scope" },
            Events = new[] { WebhookEvents.FlagEvents.Created },
            PayloadTemplateType = PayloadTemplateType.Default,
            PayloadTemplate = "{}"
        };

        var result = new CreateWebhookValidator().Validate(request);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Required("url"));
    }

    [Fact]
    public void UpdateWebhook_DelegatesToBaseValidator()
    {
        var request = new UpdateWebhook
        {
            Name = string.Empty,
            Url = "https://x",
            Scopes = new[] { "scope" },
            Events = new[] { WebhookEvents.FlagEvents.Created },
            PayloadTemplateType = PayloadTemplateType.Default,
            PayloadTemplate = "{}"
        };

        var result = new UpdateWebhookValidator().Validate(request);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Required("name"));
    }

    [Fact]
    public void SendWebhook_AllValid_NoErrors()
    {
        var request = new SendWebhook
        {
            DeliveryId = "d",
            Url = "https://x",
            Events = "feature_flag.created",
            Payload = "{\"a\":1}"
        };

        var result = new SendWebhookValidator().Validate(request);

        Assert.True(result.IsValid);
    }

    [Fact]
    public void SendWebhook_PayloadInvalidJson_PayloadInvalidError()
    {
        var request = new SendWebhook
        {
            DeliveryId = "d",
            Url = "https://x",
            Events = "feature_flag.created",
            Payload = "not-json"
        };

        var result = new SendWebhookValidator().Validate(request);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Invalid("payload"));
    }

    [Fact]
    public void SendWebhook_EmptyDeliveryId_DeliveryIdRequiredError()
    {
        var request = new SendWebhook
        {
            DeliveryId = string.Empty,
            Url = "https://x",
            Events = "feature_flag.created",
            Payload = "{}"
        };

        var result = new SendWebhookValidator().Validate(request);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Required("deliveryId"));
    }
}
