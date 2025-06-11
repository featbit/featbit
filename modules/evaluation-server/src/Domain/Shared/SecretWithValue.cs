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

    public SecretWithValue(string type, string projectKey, Guid envId, string envKey, string value)
    {
        Type = type;
        ProjectKey = projectKey;
        EnvId = envId;
        EnvKey = envKey;
        Value = value;
    }

    public Secret AsSecret()
    {
        return new Secret(Type, ProjectKey, EnvId, EnvKey);
    }
}