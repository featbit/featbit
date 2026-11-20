using Application.Bases.Mapping;
using Application.Bases.Models;
using Domain.Webhooks;
using Riok.Mapperly.Abstractions;

namespace Application.Webhooks;

[Mapper]
public static partial class WebhookMapper
{
    // The scope names and the creator are looked up and attached by the webhook handlers.
    [MapperIgnoreTarget(nameof(WebhookVm.ScopeNames))]
    [MapperIgnoreTarget(nameof(WebhookVm.Creator))]
    public static partial WebhookVm ToVm(Webhook webhook);

    public static PagedResult<WebhookVm> ToVm(PagedResult<Webhook> webhooks) => MapperConventions.MapPage(webhooks, ToVm);

    [UserMapping(Default = true)]
    private static string[] CopyStrings(string[] values) => MapperConventions.CopyArray(values);

    [UserMapping(Default = true)]
    private static KeyValuePair<string, string>[] CopyHeaders(KeyValuePair<string, string>[] headers) =>
        MapperConventions.CopyArray(headers);
}
