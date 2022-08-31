using Domain.Streaming;

namespace Domain.UnitTests.Streaming;

public class RequestHandlerTests
{
    [Theory]
    [ClassData(typeof(Requests))]
    public void Should_Validate_Request(string sdkType, string version, string tokenString, bool isValid)
    {
        Assert.Equal(isValid, RequestHandler.TryAcceptRequest(sdkType, version, tokenString));
    }
}

public class Requests : TheoryData<string, string, string, bool>
{
    public Requests()
    {
        Add(
            "client", string.Empty,
            "QPXBHMWIxLWQ0NWUtNCUyMDIyMDgwMjA2MzUzNl9fMTYxX18yMDRQQBDDBUQXBHXXQDfXzQyMV9fZGVmYXVsdF84ZDBmZQ",
            true
        );
        
        Add(
            "invalid-client", string.Empty, // invalid client
            "QPXBHMWIxLWQ0NWUtNCUyMDIyMDgwMjA2MzUzNl9fMTYxX18yMDRQQBDDBUQXBHXXQDfXzQyMV9fZGVmYXVsdF84ZDBmZQ",
            false
        );
        
        Add(
            "client", "invalid-version", // invalid version
            "QPXBHMWIxLWQ0NWUtNCUyMDIyMDgwMjA2MzUzNl9fMTYxX18yMDRQQBDDBUQXBHXXQDfXzQyMV9fZGVmYXVsdF84ZDBmZQ",
            false
        );
        
        Add(
            "client", string.Empty,
            "invalid-token-string", // invalid token string
            false
        );
    }
}