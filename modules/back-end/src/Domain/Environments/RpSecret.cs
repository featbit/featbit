namespace Domain.Environments;

// environment secret for relay proxy
public class RpSecret
{
    public string Type { get; set; } = string.Empty;

    public string ProjectKey { get; set; } = string.Empty;

    public Guid EnvId { get; set; } = Guid.Empty;

    public string EnvKey { get; set; } = string.Empty;

    public string Value { get; set; } = string.Empty;
}