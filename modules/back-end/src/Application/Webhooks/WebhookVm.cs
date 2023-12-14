using Application.Users;
using Domain.Webhooks;

namespace Application.Webhooks;

public class WebhookVm
{
    public Guid Id { get; set; }

    public string Name { get; set; }

    public string Url { get; set; }

    public string[] Scopes { get; set; }

    public string[] ScopeNames { get; set; }

    public string[] Events { get; set; }

    public KeyValuePair<string, string>[] Headers { get; set; }

    public string PayloadTemplateType { get; set; }

    public string PayloadTemplate { get; set; }

    public string Secret { get; set; }

    public bool IsActive { get; set; }

    public LastDelivery LastDelivery { get; set; }

    public UserVm Creator { get; set; }
}