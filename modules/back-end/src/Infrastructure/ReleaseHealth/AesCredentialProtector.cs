using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Application.ReleaseHealth;
using Microsoft.Extensions.Configuration;

namespace Infrastructure.ReleaseHealth;

public sealed class AesCredentialProtector(IConfiguration configuration) : ICredentialProtector
{
    private sealed record Envelope(int Version, string KeyId, string Nonce, string Ciphertext, string Tag);
    private byte[] Key(string keyId)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(keyId) || keyId.Contains(':')) throw new FormatException();
            var bytes = Convert.FromBase64String(configuration[$"ReleaseHealth:Credentials:Keys:{keyId}"] ?? "");
            if (bytes.Length != 32) throw new FormatException();
            return bytes;
        }
        catch (FormatException) { throw Schema.Invalid("credential_key_unavailable"); }
    }
    public string Protect(string plaintext, string context)
    {
        var keyId = configuration["ReleaseHealth:Credentials:ActiveKeyId"] ?? "";
        var key = Key(keyId);
        var plain = Encoding.UTF8.GetBytes(plaintext);
        try
        {
            var nonce = RandomNumberGenerator.GetBytes(12);
            var cipher = new byte[plain.Length];
            var tag = new byte[16];
            using var aes = new AesGcm(key, 16);
            aes.Encrypt(nonce, plain, cipher, tag, Encoding.UTF8.GetBytes("featbit:release-health:v1:" + context));
            return JsonSerializer.Serialize(new Envelope(1, keyId, Convert.ToBase64String(nonce), Convert.ToBase64String(cipher), Convert.ToBase64String(tag)));
        }
        finally { CryptographicOperations.ZeroMemory(plain); CryptographicOperations.ZeroMemory(key); }
    }
    public string Unprotect(string envelope, string context)
    {
        byte[]? key = null;
        byte[]? plain = null;
        try
        {
            var data = JsonSerializer.Deserialize<Envelope>(envelope) ?? throw new CryptographicException();
            if (data.Version != 1) throw new CryptographicException();
            key = Key(data.KeyId);
            var cipher = Convert.FromBase64String(data.Ciphertext);
            plain = new byte[cipher.Length];
            using var aes = new AesGcm(key, 16);
            aes.Decrypt(Convert.FromBase64String(data.Nonce), cipher, Convert.FromBase64String(data.Tag), plain,
                Encoding.UTF8.GetBytes("featbit:release-health:v1:" + context));
            return Encoding.UTF8.GetString(plain);
        }
        catch (Exception ex) when (ex is CryptographicException or FormatException or JsonException or ArgumentException)
        { throw Schema.Invalid("credential_unavailable"); }
        finally
        {
            if (plain is not null) CryptographicOperations.ZeroMemory(plain);
            if (key is not null) CryptographicOperations.ZeroMemory(key);
        }
    }
}
