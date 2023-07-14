using Streaming.Shared;

namespace Streaming.UnitTests;

public class TestData
{
    public static readonly Guid DevEnvId = new("ad99d259-1f50-4ed9-a002-7c65e25487df");
    public static readonly Guid ProdEnvId = new("8dc61769-5af3-4d9f-8cb3-d7342e24c3eb");

    public const string DevSecretString = "gpnOV3wI3kKAO9q9viC0wQWdKZrVAf2U6gAnxl4lSH3w";
    public const string ProdSecretString = "v3faJy3RCUO8d-EJiVdN6waRfGjfNan02Ms9c0LiTD6w";

    public static readonly Secret DevSecret = new(DevEnvId);
    public static readonly Secret ProdSecret = new(ProdEnvId);

    public const string DevStreamingTokenString = "QWSBHgpnOV3wI3kKAO9q9viC0wQWQQBDDDQBZWPXDQSdKZrVAf2U6gAnxl4lSH3w";
    public static Token DevStreamingToken = new()
    {
        Position = 23,
        ContentLength = 15,
        Timestamp = 1666018247603,
        Secret = DevSecret,
        IsValid = true
    };

    public const string ProdStreamingTokenString = "QBPBHv3faJy3RCUO8d-QQBDDDQBZZQQXHPEJiVdN6waRfGjfNan02Ms9c0LiTD6w";
    public static Token ProdStreamingToken = new()
    {
        Position = 14,
        ContentLength = 15,
        Timestamp = 1666018800754,
        Secret = ProdSecret,
        IsValid = true
    };
}