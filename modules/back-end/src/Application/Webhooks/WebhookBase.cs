using Application.Bases;
using Domain.Webhooks;

namespace Application.Webhooks;

public class WebhookBase
{
    public string Name { get; set; }

    public string[] Scopes { get; set; }

    public string Url { get; set; }

    public string[] Events { get; set; }

    public KeyValuePair<string, string>[] Headers { get; set; }

    public string PayloadTemplateType { get; set; }

    public string PayloadTemplate { get; set; }

    public string Secret { get; set; }

    public bool IsActive { get; set; }
}

public class WebhookBaseValidator : AbstractValidator<WebhookBase>
{
    public WebhookBaseValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("name"));

        RuleFor(x => x.Url)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("url"));

        RuleFor(x => x.Scopes)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("scopes"));

        RuleFor(x => x.Events)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("events"))
            .Must(x => x.All(y => WebhookEvents.All.Contains(y))).WithErrorCode(ErrorCodes.Invalid("events"));

        RuleFor(x => x.PayloadTemplateType)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("payloadTemplateType"))
            .Must(x => PayloadTemplateType.All.Contains(x)).WithErrorCode(ErrorCodes.Invalid("payloadTemplateType"));

        RuleFor(x => x.PayloadTemplate)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("payloadTemplate"));
    }
}