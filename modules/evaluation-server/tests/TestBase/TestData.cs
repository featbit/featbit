namespace Domain.Shared;

/// <summary>
/// Test-side aggregator for fake-mode constants. Forwards the production seed values from
/// <see cref="FakeSeedData"/> and adds the test-only <see cref="Token"/> instances and
/// token strings that tests use to drive the streaming/HTTP entry points.
/// </summary>
public static class TestData
{
    // ---- Forwarded production seed values ----

    public static Guid ClientEnvId => FakeSeedData.ClientEnvId;
    public static Secret ClientSecret => FakeSeedData.ClientSecret;
    public const string ClientSecretString = FakeSeedData.ClientSecretString;

    public static Guid ServerEnvId => FakeSeedData.ServerEnvId;
    public static Secret ServerSecret => FakeSeedData.ServerSecret;
    public const string ServerSecretString = FakeSeedData.ServerSecretString;

    public const string RelayProxyTokenString = FakeSeedData.RelayProxyTokenString;

    // ---- Test-only token fixtures ----

    public const string ClientTokenString = "QWSBHgpnOV3wI3kKAO9q9viC0wQWQQBDDDQBZWPXDQSdKZrVAf2U6gAnxl4lSH3w";

    public static readonly Token ClientToken = new()
    {
        Position = 23,
        ContentLength = 15,
        Timestamp = 1666018247603,
        SecretString = ClientSecretString,
        IsValid = true
    };

    public const string ServerTokenString = "QBPBHv3faJy3RCUO8d-QQBDDDQBZZQQXHPEJiVdN6waRfGjfNan02Ms9c0LiTD6w";

    public static readonly Token ServerToken = new()
    {
        Position = 14,
        ContentLength = 15,
        Timestamp = 1666018800754,
        SecretString = ServerSecretString,
        IsValid = true
    };
}
