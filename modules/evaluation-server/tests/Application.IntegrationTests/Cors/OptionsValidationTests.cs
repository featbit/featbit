using Api.Cors;

namespace Application.IntegrationTests.Cors;

public class OptionsValidationTests
{
    private readonly CorsOptionsValidator _validator = new();

    [Theory]
    [ClassData(typeof(InvalidOptions))]
    public void Validate_ReturnsFailure_ForInvalidOptions(CorsOptions options, string expectedMessage)
    {
        var result = _validator.Validate(null, options);

        Assert.True(result.Failed);
        Assert.Contains(expectedMessage, result.FailureMessage);
    }

    [Fact]
    public void ValidSetting()
    {
        var options = new CorsOptions
        {
            Enabled = true,
            AllowedOrigins = ["https://app.example.com", "https://admin.example.com"],
            AllowedHeaders = ["Authorization", "X-Custom"],
            AllowedMethods = ["GET", "POST"]
        };

        var result = _validator.Validate(null, options);

        Assert.True(result.Succeeded);
    }

    [Fact]
    public void SkipWhenDisabled()
    {
        var options = new CorsOptions
        {
            Enabled = false,
            AllowedOrigins = [],
            AllowedHeaders = [],
            AllowedMethods = [],
            AllowCredentials = true
        };

        var result = _validator.Validate(null, options);

        Assert.True(result.Succeeded);
    }
}

public class InvalidOptions : TheoryData<CorsOptions, string>
{
    public InvalidOptions()
    {
        Add(new CorsOptions
        {
            Enabled = true,
            AllowedOrigins = [],
            AllowedHeaders = ["*"],
            AllowedMethods = ["*"]
        }, "AllowedOrigins must contain at least one value");

        Add(new CorsOptions
        {
            Enabled = true,
            AllowedOrigins = ["*"],
            AllowedHeaders = [],
            AllowedMethods = ["*"]
        }, "AllowedHeaders must contain at least one value");

        Add(new CorsOptions
        {
            Enabled = true,
            AllowedOrigins = ["*"],
            AllowedHeaders = ["*"],
            AllowedMethods = []
        }, "AllowedMethods must contain at least one value");

        Add(new CorsOptions
        {
            Enabled = true,
            AllowedOrigins = ["*"],
            AllowedHeaders = ["*"],
            AllowedMethods = ["*"],
            AllowCredentials = true
        }, "AllowCredentials cannot be used with a wildcard");

        Add(new CorsOptions
        {
            Enabled = true,
            AllowedOrigins = ["*", "https://app.example.com"],
            AllowedHeaders = ["*"],
            AllowedMethods = ["*"]
        }, "AllowedOrigins cannot mix wildcard");

        Add(new CorsOptions
        {
            Enabled = true,
            AllowedOrigins = ["https://app.example.com,https://admin.example.com"],
            AllowedHeaders = ["*"],
            AllowedMethods = ["*"]
        }, "Commas are not supported");

        Add(new CorsOptions
        {
            Enabled = true,
            AllowedOrigins = ["example.com"],
            AllowedHeaders = ["*"],
            AllowedMethods = ["*"]
        }, "invalid value 'example.com'");
    }
}