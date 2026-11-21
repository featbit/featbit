using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Application.Bases.Exceptions;
using Microsoft.Extensions.Options;

namespace Infrastructure.Services;

public sealed class ProviderCredentialProtector(IOptionsMonitor<ProviderCredentialOptions> options) : IProviderCredentialProtector
{
    private const int NonceSize = 12;
    private const int TagSize = 16;

    private sealed record Envelope(int Version, string KeyId, byte[] Nonce, byte[] Ciphertext, byte[] Tag);

    public string Protect(string secret, string context)
    {
        var settings = options.CurrentValue;
        var keyId = settings.ActiveKeyId;
        var key = ReadKey(settings, keyId);
        var plaintext = Encoding.UTF8.GetBytes(secret);
        try
        {
            var nonce = RandomNumberGenerator.GetBytes(NonceSize);
            var ciphertext = new byte[plaintext.Length];
            var tag = new byte[TagSize];
            using var aes = new AesGcm(key, TagSize);
            aes.Encrypt(nonce, plaintext, ciphertext, tag, Encoding.UTF8.GetBytes(context));
            return JsonSerializer.Serialize(new Envelope(1, keyId, nonce, ciphertext, tag));
        }
        finally
        {
            CryptographicOperations.ZeroMemory(plaintext);
            CryptographicOperations.ZeroMemory(key);
        }
    }

    public string Unprotect(string protectedCredential, string context)
    {
        byte[]? key = null;
        byte[]? plaintext = null;
        try
        {
            var envelope = JsonSerializer.Deserialize<Envelope>(protectedCredential);
            if (envelope is not { Version: 1, Nonce.Length: NonceSize, Tag.Length: TagSize, Ciphertext.Length: > 0 })
            {
                throw new CryptographicException();
            }

            key = ReadKey(options.CurrentValue, envelope.KeyId);
            plaintext = new byte[envelope.Ciphertext.Length];
            using var aes = new AesGcm(key, TagSize);
            aes.Decrypt(envelope.Nonce, envelope.Ciphertext, envelope.Tag, plaintext, Encoding.UTF8.GetBytes(context));
            return Encoding.UTF8.GetString(plaintext);
        }
        catch (Exception ex) when (ex is JsonException or ArgumentException or CryptographicException)
        {
            throw new BusinessException("provider_credential_unavailable");
        }
        finally
        {
            if (key != null) CryptographicOperations.ZeroMemory(key);
            if (plaintext != null) CryptographicOperations.ZeroMemory(plaintext);
        }
    }

    private static byte[] ReadKey(ProviderCredentialOptions settings, string keyId)
    {
        var key = new byte[ProviderCredentialOptions.KeySize];
        if (!settings.TryReadKey(keyId, key))
        {
            CryptographicOperations.ZeroMemory(key);
            throw new BusinessException("provider_credential_key_unavailable");
        }

        return key;
    }
}
