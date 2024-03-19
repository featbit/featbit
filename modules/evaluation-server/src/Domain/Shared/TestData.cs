namespace Domain.Shared;

public static class TestData
{
    public static readonly Guid ClientEnvId = new("ad99d259-1f50-4ed9-a002-7c65e25487df");
    public static readonly Secret ClientSecret = new("client", "webapp", ClientEnvId, "dev");
    public const string ClientSecretString = "gpnOV3wI3kKAO9q9viC0wQWdKZrVAf2U6gAnxl4lSH3w";
    public const string ClientTokenString = "QWSBHgpnOV3wI3kKAO9q9viC0wQWQQBDDDQBZWPXDQSdKZrVAf2U6gAnxl4lSH3w";

    public static readonly Token ClientToken = new()
    {
        Position = 23,
        ContentLength = 15,
        Timestamp = 1666018247603,
        SecretString = ClientSecretString,
        IsValid = true
    };

    public static readonly Guid ServerEnvId = new("8dc61769-5af3-4d9f-8cb3-d7342e24c3eb");
    public static readonly Secret ServerSecret = new("server", "webapp", ServerEnvId, "prod");
    public const string ServerSecretString = "v3faJy3RCUO8d-EJiVdN6waRfGjfNan02Ms9c0LiTD6w";
    public const string ServerTokenString = "QBPBHv3faJy3RCUO8d-QQBDDDQBZZQQXHPEJiVdN6waRfGjfNan02Ms9c0LiTD6w";

    public static readonly Token ServerToken = new()
    {
        Position = 14,
        ContentLength = 15,
        Timestamp = 1666018800754,
        SecretString = ServerSecretString,
        IsValid = true
    };

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