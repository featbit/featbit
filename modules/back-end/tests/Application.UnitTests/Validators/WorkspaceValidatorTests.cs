using Application.Bases;
using Application.Workspaces;

namespace Application.UnitTests.Validators;

public class WorkspaceValidatorTests
{
    private static UpdateOidc ValidOidc() => new()
    {
        ClientId = "c", ClientSecret = "s", TokenEndpoint = "t", ClientAuthenticationMethod = "m",
        AuthorizationEndpoint = "a", Scope = "openid", UserEmailClaim = "email"
    };

    [Fact]
    public void UpdateOidc_AllValid_NoErrors()
    {
        var result = new UpdateOidcValidator().Validate(ValidOidc());

        Assert.True(result.IsValid);
    }

    [Theory]
    [InlineData("clientId")]
    [InlineData("clientSecret")]
    [InlineData("tokenEndpoint")]
    [InlineData("clientAuthenticationMethod")]
    [InlineData("authorizationEndpoint")]
    [InlineData("scope")]
    [InlineData("userEmailClaim")]
    public void UpdateOidc_MissingField_RequiredError(string field)
    {
        var oidc = ValidOidc();
        switch (field)
        {
            case "clientId": oidc.ClientId = string.Empty; break;
            case "clientSecret": oidc.ClientSecret = string.Empty; break;
            case "tokenEndpoint": oidc.TokenEndpoint = string.Empty; break;
            case "clientAuthenticationMethod": oidc.ClientAuthenticationMethod = string.Empty; break;
            case "authorizationEndpoint": oidc.AuthorizationEndpoint = string.Empty; break;
            case "scope": oidc.Scope = string.Empty; break;
            case "userEmailClaim": oidc.UserEmailClaim = string.Empty; break;
        }

        var result = new UpdateOidcValidator().Validate(oidc);

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Required(field));
    }

    [Theory]
    [InlineData("", "k", "name")]
    [InlineData("n", "", "key")]
    public void UpdateWorkspace_MissingField_RequiredError(string name, string key, string field)
    {
        var result = new UpdateWorkspaceValidator().Validate(new UpdateWorkspace { Name = name, Key = key });

        Assert.Contains(result.Errors, e => e.ErrorCode == ErrorCodes.Required(field));
    }
}
