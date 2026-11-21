using System.Security.Cryptography;

namespace Infrastructure.Services;

public sealed class ProviderCredentialOptions
{
    internal const string Section = "ReleaseHealth:Credentials";
    internal const int KeySize = 32;

    public string ActiveKeyId { get; set; } = string.Empty;
    public Dictionary<string, string> Keys { get; set; } = new(StringComparer.Ordinal);

    internal bool HasValidKeyRing()
    {
        if (string.IsNullOrWhiteSpace(ActiveKeyId) || !Keys.ContainsKey(ActiveKeyId)) return false;
        Span<byte> decoded = stackalloc byte[KeySize];
        try
        {
            foreach (var keyId in Keys.Keys)
            {
                if (!TryReadKey(keyId, decoded)) return false;
            }
            return true;
        }
        finally
        {
            CryptographicOperations.ZeroMemory(decoded);
        }
    }

    internal bool TryReadKey(string keyId, Span<byte> decoded) =>
        !string.IsNullOrWhiteSpace(keyId) && !keyId.Contains(':') &&
        Keys.TryGetValue(keyId, out var encoded) && encoded != null &&
        Convert.TryFromBase64String(encoded, decoded, out var length) && length == KeySize;
}
