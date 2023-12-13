namespace Domain.Webhooks;

public class Webhook : FullAuditedEntity
{
    public Guid OrgId { get; set; }

    public string Name { get; set; }

    public string Url { get; set; }

    public string[] Scopes { get; set; }

    public string[] Events { get; set; }

    public KeyValuePair<string, string>[] Headers { get; set; }

    public string PayloadTemplateType { get; set; }

    public string PayloadTemplate { get; set; }

    public string Secret { get; set; }

    public bool IsActive { get; set; }

    public LastDelivery LastDelivery { get; set; }

    public Webhook(
        Guid orgId,
        string name,
        string[] scopes,
        string url,
        string[] events,
        KeyValuePair<string, string>[] headers,
        string payloadTemplateType,
        string payloadTemplate,
        string secret,
        bool isActive,
        Guid creatorId) : base(creatorId)
    {
        OrgId = orgId;
        Name = name;
        Url = url;

        Scopes = scopes ?? Array.Empty<string>();
        Events = events ?? Array.Empty<string>();

        Headers = headers ?? Array.Empty<KeyValuePair<string, string>>();
        PayloadTemplateType = payloadTemplateType;
        PayloadTemplate = payloadTemplate;
        Secret = secret ?? string.Empty;

        IsActive = isActive;
        LastDelivery = null;
    }

    public void Update(
        string name,
        string[] scopes,
        string url,
        string[] events,
        KeyValuePair<string, string>[] headers,
        string payloadTemplateType,
        string payloadTemplate,
        string secret,
        bool isActive,
        Guid currentUserId)
    {
        Name = name;
        Url = url;

        Scopes = scopes ?? Array.Empty<string>();
        Events = events ?? Array.Empty<string>();

        Headers = headers ?? Array.Empty<KeyValuePair<string, string>>();
        PayloadTemplateType = payloadTemplateType;
        PayloadTemplate = payloadTemplate;
        Secret = secret ?? string.Empty;

        IsActive = isActive;

        MarkAsUpdated(currentUserId);
    }
}