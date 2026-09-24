using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Application.Bases.Exceptions;
using Application.ReleaseHealth;
using Microsoft.Extensions.Logging;

namespace Infrastructure.ReleaseHealth;

public sealed partial class ReleaseHealthService
{
    public const string MonitorWebhookKind = "monitor_alert_webhook";
    private sealed record MonitorWebhookState(string Purpose, string Name, string Url, bool IsActive,
        string[] Scopes, string[] ScopeNames, string PayloadTemplateType, string PayloadTemplate,
        bool HasHeaders, bool HasSecret, DateTimeOffset CreatedAt, DateTimeOffset UpdatedAt,
        Guid UpdatedBy, bool IsDeleted = false);
    private sealed record MonitorWebhookCredentials(MonitorWebhookHeader[] Headers, string Secret);

    private static string WebhookSecretContext(ReleaseHealthDocument document, MonitorWebhookState state) =>
        $"monitor-alert-webhook:{document.ScopeId}:{document.Id}:{Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(state.Url)))}";
    private static MonitorWebhookView WebhookView(ReleaseHealthDocument document)
    {
        var state = Read<MonitorWebhookState>(document);
        return new(document.Id, state.Purpose, state.Name, state.Url, state.IsActive, state.Scopes,
            state.ScopeNames, state.PayloadTemplateType, state.PayloadTemplate, document.Version, state.HasHeaders, state.HasSecret);
    }

    public async Task<IReadOnlyList<MonitorWebhookView>> MonitorWebhooks(Guid orgId, CancellationToken ct) =>
        (await store.ListAsync(orgId, MonitorWebhookKind, ct)).Where(x => !Read<MonitorWebhookState>(x).IsDeleted).Select(WebhookView).ToArray();

    public async Task<MonitorWebhookView> MonitorWebhook(Guid orgId, Guid id, CancellationToken ct)
    {
        var document = await Required(orgId, MonitorWebhookKind, id, ct);
        if (Read<MonitorWebhookState>(document).IsDeleted) throw Missing(id);
        return WebhookView(document);
    }

    public async Task<bool> StoredMonitorWebhookScopeExists(Guid orgId, Guid projectId, Guid envId)
    {
        var project = await projects.FindOneAsync(x => x.Id == projectId);
        if (project is null) return false;
        if (project.OrganizationId != orgId) throw new ForbiddenException();
        var env = await environments.FindOneAsync(x => x.Id == envId);
        if (env is null) return false;
        if (env.ProjectId != projectId) throw Schema.Invalid("invalid_webhook_scopes");
        return true;
    }

    public static IReadOnlyList<(Guid ProjectId, Guid EnvironmentId)> ParseMonitorWebhookScopes(string[]? scopes)
    {
        if (scopes is null || scopes.Length is < 1 or > 100) throw Schema.Invalid("invalid_webhook_scopes");
        HashSet<(Guid, Guid)> values = [];
        foreach (var scope in scopes)
        {
            var parts = scope?.Split('/');
            if (parts is not { Length: 2 } || !Guid.TryParse(parts[0], out var projectId) || projectId == Guid.Empty)
                throw Schema.Invalid("invalid_webhook_scopes");
            foreach (var value in parts[1].Split(','))
            {
                if (!Guid.TryParse(value, out var envId) || envId == Guid.Empty || !values.Add((projectId, envId)))
                    throw Schema.Invalid("invalid_webhook_scopes");
            }
        }
        if (values.Count > 200) throw Schema.Invalid("invalid_webhook_scopes");
        return values.OrderBy(x => x.Item1).ThenBy(x => x.Item2).ToArray();
    }

    public async Task ValidateMonitorWebhook(Guid orgId, Guid projectId, Guid envId, Guid id, CancellationToken ct)
    {
        var document = await store.FindAsync(orgId, MonitorWebhookKind, id, ct);
        var state = document is null ? null : Read<MonitorWebhookState>(document);
        if (state is null || state.Purpose != "release-health" || state.IsDeleted || !state.IsActive ||
            !ParseMonitorWebhookScopes(state.Scopes).Contains((projectId, envId)))
            throw Schema.Invalid("monitor_webhook_unavailable");
    }

    public async Task<MonitorWebhookView> SaveMonitorWebhook(Guid orgId, Guid? id, MonitorWebhookWrite write, Guid actor, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(write.Name) || write.Name.Trim().Length > 100 || write.Name.Any(char.IsControl))
            throw Schema.Invalid("invalid_webhook_name");
        if (!Uri.TryCreate(write.Url?.Trim(), UriKind.Absolute, out var endpoint) ||
            endpoint.Scheme is not ("http" or "https") || endpoint.UserInfo.Length > 0 || endpoint.Fragment.Length > 0)
            throw Schema.Invalid("invalid_webhook_endpoint");
        if (write.PayloadTemplateType is not ("default" or "custom")) throw Schema.Invalid("invalid_webhook_template_type");
        MonitorWebhookTemplate.Validate(write.PayloadTemplate);
        var previous = id is null ? null : await Required(orgId, MonitorWebhookKind, id.Value, ct);
        Expected(previous, write.ExpectedVersion);
        var oldState = previous is null ? null : Read<MonitorWebhookState>(previous);
        if (oldState?.IsDeleted == true) throw Missing(id!.Value);
        var normalizedName = write.Name.Trim();
        if ((await MonitorWebhooks(orgId, ct)).Any(x => x.Id != id && string.Equals(x.Name, normalizedName, StringComparison.OrdinalIgnoreCase)))
            throw Schema.Invalid("webhook_name_used");
        List<string> scopeNames = [];
        var scopeValues = ParseMonitorWebhookScopes(write.Scopes);
        foreach (var (projectId, envId) in scopeValues)
        {
            await Scope(orgId, projectId, envId);
            var project = await projects.FindOneAsync(x => x.Id == projectId && x.OrganizationId == orgId);
            var env = await environments.FindOneAsync(x => x.Id == envId && x.ProjectId == projectId);
            scopeNames.Add($"{project!.Name}/{env!.Name}");
        }
        var scopes = scopeValues.Select(x => $"{x.ProjectId}/{x.EnvironmentId}").ToArray();
        var headersUpdate = write.HeadersUpdate ?? throw Schema.Invalid("invalid_webhook_credentials");
        var secretUpdate = write.SecretUpdate ?? throw Schema.Invalid("invalid_webhook_credentials");
        if (headersUpdate.Operation is not ("keep" or "replace" or "remove") || secretUpdate.Operation is not ("keep" or "replace" or "remove") ||
            (headersUpdate.Operation != "replace" && headersUpdate.Headers is not null) ||
            (secretUpdate.Operation != "replace" && secretUpdate.Secret is not null)) throw Schema.Invalid("invalid_webhook_credentials");
        MonitorWebhookCredentials existing = new([], "");
        // Full replacement/removal can recover without decrypting an unavailable previous key.
        if (previous?.ProtectedSecrets is not null &&
            ((headersUpdate.Operation == "keep" && oldState!.HasHeaders) || (secretUpdate.Operation == "keep" && oldState!.HasSecret)))
            existing = JsonSerializer.Deserialize<MonitorWebhookCredentials>(protector.Unprotect(previous.ProtectedSecrets, WebhookSecretContext(previous, oldState!)), JsonOptions)!;
        var headers = headersUpdate.Operation switch
        {
            "keep" => existing.Headers,
            "remove" => [],
            _ => ValidateWebhookHeaders(headersUpdate.Headers)
        };
        var secret = secretUpdate.Operation switch
        {
            "keep" => existing.Secret,
            "remove" => "",
            _ => secretUpdate.Secret ?? throw Schema.Invalid("invalid_webhook_secret")
        };
        if (secret.Length > 4096 || secret.Contains('\0')) throw Schema.Invalid("invalid_webhook_secret");
        var now = DateTimeOffset.UtcNow;
        var state = new MonitorWebhookState("release-health", normalizedName, endpoint.AbsoluteUri, write.IsActive, scopes,
            scopeNames.ToArray(), write.PayloadTemplateType, write.PayloadTemplate, headers.Length > 0, secret.Length > 0,
            oldState?.CreatedAt ?? now, now, actor);
        var webhookId = id ?? Guid.NewGuid();
        var document = new ReleaseHealthDocument(webhookId, orgId, orgId, MonitorWebhookKind, webhookId.ToString(),
            (previous?.Version ?? 0) + 1, Serialize(state), null);
        if (state.HasHeaders || state.HasSecret)
            document = document with { ProtectedSecrets = protector.Protect(Serialize(new MonitorWebhookCredentials(headers, secret)), WebhookSecretContext(document, state)) };
        await store.PutAsync(document, write.ExpectedVersion, ct);
        logger.LogInformation("ReleaseHealth webhook saved. Organization={OrganizationId} Webhook={WebhookId} Version={Version} Actor={Actor}", orgId, webhookId, document.Version, actor);
        return WebhookView(document);
    }

    private static MonitorWebhookHeader[] ValidateWebhookHeaders(MonitorWebhookHeader[]? headers)
    {
        if (headers is null || headers.Length > 50) throw Schema.Invalid("invalid_webhook_headers");
        HashSet<string> keys = new(StringComparer.OrdinalIgnoreCase);
        List<MonitorWebhookHeader> clean = [];
        foreach (var header in headers)
        {
            if (header?.Key is null || header.Value is null) throw Schema.Invalid("invalid_webhook_headers");
            var key = header.Key.Trim();
            if (key.Length == 0 && header.Value.Length == 0) continue;
            if (key.Length > 200 || !Regex.IsMatch(key, "^[!#$%&'*+.^_`|~0-9A-Za-z-]+$") || !keys.Add(key) ||
                header.Value.Length > 8192 || header.Value.IndexOfAny(['\r', '\n', '\0']) >= 0) throw Schema.Invalid("invalid_webhook_headers");
            clean.Add(new(key, header.Value));
        }
        return clean.ToArray();
    }

    public async Task RemoveMonitorWebhook(Guid orgId, Guid id, long expectedVersion, Guid actor, CancellationToken ct)
    {
        var document = await Required(orgId, MonitorWebhookKind, id, ct);
        Expected(document, expectedVersion);
        var state = Read<MonitorWebhookState>(document);
        if (state.IsDeleted) throw Missing(id);
        await store.PutAsync(document with { Version = document.Version + 1, ProtectedSecrets = null,
            Payload = Serialize(state with { IsDeleted = true, IsActive = false, HasHeaders = false, HasSecret = false, UpdatedAt = DateTimeOffset.UtcNow, UpdatedBy = actor }) }, expectedVersion, ct);
        logger.LogInformation("ReleaseHealth webhook removed. Organization={OrganizationId} Webhook={WebhookId} Actor={Actor}", orgId, id, actor);
    }
}
