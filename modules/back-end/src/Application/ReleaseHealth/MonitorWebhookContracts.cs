#nullable enable
using System.Text.Json.Serialization;

namespace Application.ReleaseHealth;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record MonitorWebhookHeader(string Key, string Value);
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record MonitorWebhookHeadersUpdate(string Operation, MonitorWebhookHeader[]? Headers = null);
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record MonitorWebhookSecretUpdate(string Operation, string? Secret = null);
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed record MonitorWebhookWrite(string Name, string Url, bool IsActive, string[] Scopes,
    string PayloadTemplateType, string PayloadTemplate, MonitorWebhookHeadersUpdate HeadersUpdate,
    MonitorWebhookSecretUpdate SecretUpdate, long? ExpectedVersion);

// Credentials are write-only: neither plaintext nor protected envelopes are returned.
public sealed record MonitorWebhookView(Guid Id, string Purpose, string Name, string Url, bool IsActive,
    string[] Scopes, string[] ScopeNames, string PayloadTemplateType, string PayloadTemplate, long Version,
    bool HasHeaders, bool HasSecret, bool CanManage = true);
