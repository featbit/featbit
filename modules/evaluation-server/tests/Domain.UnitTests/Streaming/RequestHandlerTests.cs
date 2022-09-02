using Domain.Streaming;

namespace Domain.UnitTests.Streaming;

public class RequestHandlerTests
{
    [Theory]
    [ClassData(typeof(Requests))]
    public void Should_Validate_Request(
        string sdkType, 
        string version, 
        string tokenString, 
        long currentTimestamp, 
        bool isValid)
    {
        Assert.Equal(isValid, RequestHandler.TryAcceptRequest(sdkType, version, tokenString, currentTimestamp));
    }
}

public class Requests : TheoryData<string, string, string, long, bool>
{
    public Requests()
    {
        const string sdkType = "client";
        const string version = "";
        const string token =
            "QPXBHMWIxLWQ0NWUtNCUyMDIyMDgwMjA2MzUzNl9fMTYxX18yMDRQQBDDBUQXBHXXQDfXzQyMV9fZGVmYXVsdF84ZDBmZQ";
        const long tokenCreatedAt = 1661907157706;

        // valid
        Add(sdkType, version, token, tokenCreatedAt, true);

        // invalid client
        Add("invalid-client", version, token, tokenCreatedAt, false);

        // invalid version
        Add(sdkType, "invalid-version", token, tokenCreatedAt, false);

        // invalid token string
        Add(sdkType, version, "invalid-token-string", tokenCreatedAt, false);
        
        // invalid timestamp (after/before 31s)
        Add(sdkType, version, token, tokenCreatedAt + 31 * 1000, false);
        Add(sdkType, version, token, tokenCreatedAt - 31 * 1000, false);
    }
}