namespace Domain.Shared;

/// <summary>
/// Seed values used by the fake cache/MQ providers (<c>Infrastructure.Fakes</c>) to power
/// local-development mode. These constants are also referenced from tests, but they live
/// in <c>src</c> because production code depends on them.
/// </summary>
public static class FakeSeedData
{
    public static readonly Guid ClientEnvId = new("ad99d259-1f50-4ed9-a002-7c65e25487df");
    public static readonly Secret ClientSecret = new(SecretTypes.Client, "webapp", ClientEnvId, "dev");
    public const string ClientSecretString = "gpnOV3wI3kKAO9q9viC0wQWdKZrVAf2U6gAnxl4lSH3w";

    public static readonly Guid ServerEnvId = new("8dc61769-5af3-4d9f-8cb3-d7342e24c3eb");
    public static readonly Secret ServerSecret = new(SecretTypes.Server, "webapp", ServerEnvId, "prod");
    public const string ServerSecretString = "v3faJy3RCUO8d-EJiVdN6waRfGjfNan02Ms9c0LiTD6w";

    public const string RelayProxyTokenString = "rp-MDcwNTEzNDExNzQ3MQtXO7IPcN6U-z5fAktj18CQ";

    public static Secret? GetSecret(string secretString)
    {
        return secretString switch
        {
            ClientSecretString => ClientSecret,
            ServerSecretString => ServerSecret,
            _ => null
        };
    }
}
