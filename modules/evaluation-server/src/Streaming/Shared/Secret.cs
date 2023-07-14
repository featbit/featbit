namespace Streaming.Shared;

public struct Secret
{
    public Guid EnvId { get; set; }

    public Secret(Guid envId)
    {
        EnvId = envId;
    }

    public static bool TryParse(string secretString, out Secret secret)
    {
        // secret string format: {encodedGuid}{encodedEnvId}
        // encoded guid's length will always be 22, see GuidHelper.Encode

        secret = default;
        if (string.IsNullOrWhiteSpace(secretString) || secretString.Length != 44)
        {
            return false;
        }

        var encodedEnvId = secretString.AsSpan().Slice(22, 22);
        secret.EnvId = GuidHelper.Decode(encodedEnvId);

        return secret.EnvId != Guid.Empty;
    }
}