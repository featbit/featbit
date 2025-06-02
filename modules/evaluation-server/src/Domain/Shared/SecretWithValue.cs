namespace Domain.Shared;

public class SecretWithValue
{
    public string Type { get; set; } = string.Empty;

    public string ProjectKey { get; set; } = string.Empty;

    public Guid EnvId { get; set; } = Guid.Empty;

    public string EnvKey { get; set; } = string.Empty;

    public string Value { get; set; } = string.Empty;

    // for dapper deserialization
    public SecretWithValue()
    {
    }

    public SecretWithValue(Secret secret, string value)
    {
        Type = secret.Type;
        ProjectKey = secret.ProjectKey;
        EnvId = secret.EnvId;
        EnvKey = secret.EnvKey;
        Value = value;
    }

    public Secret AsSecret()
    {
        return new Secret(Type, ProjectKey, EnvId, EnvKey);
    }

    public SecretSlim AsSecretSlim()
    {
        return new SecretSlim(EnvId, Type, Value);
    }
}