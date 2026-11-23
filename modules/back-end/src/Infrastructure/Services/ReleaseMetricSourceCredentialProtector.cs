using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;
using Application.Bases;
using Application.Bases.Exceptions;
using Domain.Environments;
using Domain.ReleaseMetricSourceConnections;

namespace Infrastructure.Services;

public sealed class ReleaseMetricSourceCredentialProtector : IReleaseMetricSourceCredentialProtector
{
    private const int NonceSize = 12;
    private const int TagSize = 16;
    private readonly KeyRing? _keyRing;

    private sealed record KeyRing(string Active, Dictionary<string, byte[]> Keys);

    public ReleaseMetricSourceCredentialProtector(string? keyRingJson)
    {
        if (keyRingJson == null)
        {
            return;
        }

        // A malformed deployment secret must never be included in a startup exception.
        try
        {
            var options = new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
                AllowDuplicateProperties = false,
                UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow
            };
            var ring = JsonSerializer.Deserialize<KeyRing>(keyRingJson, options);
            if (ring?.Active != null && ring.Keys != null && ring.Keys.ContainsKey(ring.Active) &&
                ring.Keys.All(entry => IsValidKeyId(entry.Key) && entry.Value?.Length == 32))
            {
                _keyRing = ring;
                return;
            }
        }
        catch (JsonException)
        {
            // Fall through to the same value-free configuration error.
        }

        throw new InvalidOperationException("ReleaseHealth:CredentialKeyRing must specify an active key and valid 256-bit keys.");
    }

    public string Protect(ResourceDescriptor scope, ReleaseMetricSourceConnection connection, JsonElement credential)
    {
        var ring = _keyRing ?? throw new BusinessException(ErrorCodes.CredentialProtectionNotConfigured);
        var context = ProtectionContext(scope, connection, ring.Active);
        var nonce = RandomNumberGenerator.GetBytes(NonceSize);
        var plaintext = JsonSerializer.SerializeToUtf8Bytes(credential);
        var ciphertext = new byte[plaintext.Length];
        var tag = new byte[TagSize];
        try
        {
            using var aes = new AesGcm(ring.Keys[ring.Active], TagSize);
            aes.Encrypt(nonce, plaintext, ciphertext, tag, context);
            return string.Join('.', "1", ring.Active, Convert.ToBase64String(nonce),
                Convert.ToBase64String(ciphertext), Convert.ToBase64String(tag));
        }
        finally
        {
            CryptographicOperations.ZeroMemory(plaintext);
        }
    }

    public JsonElement? Unprotect(ResourceDescriptor scope, ReleaseMetricSourceConnection connection)
    {
        if (connection.ProtectedCredential == null)
        {
            return null;
        }

        var ring = _keyRing ?? throw new BusinessException(ErrorCodes.CredentialProtectionNotConfigured);
        var parts = connection.ProtectedCredential.Split('.', 5);
        if (parts.Length != 5 || parts[0] != "1" || !ring.Keys.TryGetValue(parts[1], out var key))
        {
            throw new BusinessException(ErrorCodes.CredentialUnavailable);
        }

        try
        {
            var nonce = Convert.FromBase64String(parts[2]);
            var ciphertext = Convert.FromBase64String(parts[3]);
            var tag = Convert.FromBase64String(parts[4]);
            if (nonce.Length != NonceSize || tag.Length != TagSize)
            {
                throw new BusinessException(ErrorCodes.CredentialUnavailable);
            }

            var plaintext = new byte[ciphertext.Length];
            try
            {
                using var aes = new AesGcm(key, TagSize);
                aes.Decrypt(nonce, ciphertext, tag, plaintext, ProtectionContext(scope, connection, parts[1]));
                return JsonSerializer.Deserialize<JsonElement>(plaintext);
            }
            finally
            {
                CryptographicOperations.ZeroMemory(plaintext);
            }
        }
        catch (Exception ex) when (ex is CryptographicException or FormatException or JsonException or InvalidOperationException)
        {
            throw new BusinessException(ErrorCodes.CredentialUnavailable);
        }
    }

    private static bool IsValidKeyId(string id) =>
        id.Length is > 0 and <= 64 && id.All(c => char.IsAsciiLetterOrDigit(c) || c is '-' or '_');

    private static byte[] ProtectionContext(ResourceDescriptor scope, ReleaseMetricSourceConnection connection, string keyId)
    {
        if (scope.Environment.Id != connection.EnvId)
        {
            throw new BusinessException(ErrorCodes.CredentialUnavailable);
        }

        // JSONB and BSON can reorder properties. Authenticate both public objects in a stable order.
        var settings = connection.ConnectionConfiguration;
        return JsonSerializer.SerializeToUtf8Bytes(new
        {
            Purpose = "FeatBit.ReleaseMetricSourceConnection.Credential.v1",
            KeyId = keyId,
            Organization = scope.Organization.Id,
            Project = scope.Project.Id,
            Environment = connection.EnvId,
            Connection = connection.Id,
            connection.ProviderType,
            ProviderConfig = OrderedFields(settings.ProviderConfig),
            Authentication = OrderedFields(settings.Authentication)
        });
    }

    private static IEnumerable<KeyValuePair<string, string?>> OrderedFields(JsonElement settings) =>
        settings.EnumerateObject().OrderBy(p => p.Name, StringComparer.Ordinal)
            .Select(p => KeyValuePair.Create(p.Name, p.Value.GetString()));
}
