using System.Linq.Expressions;
using System.Net;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Api.Authentication;
using Api.Authentication.OpenIdConnect;
using Api.Authorization;
using Api.Controllers;
using Application.Identity;
using Application.Services;
using Domain.Organizations;
using Domain.Users;
using Domain.Workspaces;
using Infrastructure.Identity;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Api.UnitTests.Controllers;

public class SsoOnboardingTests
{
    [Theory]
    [InlineData(false, false, true)]
    [InlineData(true, false, true)]
    [InlineData(false, true, true)]
    [InlineData(false, false, false)]
    public async Task OnlySuccessfulOidcLoginWithoutOrganizationMembership_IssuesJoinTicket(
        bool newUser, bool alreadyInOrganization, bool codeExchangeSucceeds)
    {
        var workspace = new Workspace
        {
            Id = Guid.NewGuid(), Key = "sso-workspace",
            Sso = new SsoConfig
            {
                Oidc = new OidcConfig
                {
                    TokenEndpoint = "https://identity.example/token", ClientId = "test",
                    UserEmailClaim = "email"
                }
            }
        };
        using var rsa = RSA.Create(2048);
        LicenseVerifier.ImportPublicKey(rsa.ExportSubjectPublicKeyInfoPem());
        var license = new License
        {
            WsId = workspace.Id, Issuer = "https://www.featbit.co",
            Exp = DateTimeOffset.UtcNow.AddHours(1).ToUnixTimeMilliseconds(), Features = [LicenseFeatures.Sso]
        };
        var payload = Convert.ToBase64String(JsonSerializer.SerializeToUtf8Bytes(license, JsonSerializerOptions.Web));
        var signature = rsa.SignData(Encoding.UTF8.GetBytes(payload), HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        workspace.License = $"{Convert.ToBase64String(signature)}.{payload}";

        var user = new User(Guid.NewGuid(), "user@example.com", "", origin: newUser ? UserOrigin.Sso : UserOrigin.Local);
        var users = new Mock<IUserService>();
        users.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<User, bool>>>())).ReturnsAsync(newUser ? null : user);
        users.Setup(x => x.GetWorkspacesAsync(user.Id)).ReturnsAsync([workspace]);
        var workspaces = new Mock<IWorkspaceService>();
        workspaces.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<Workspace, bool>>>())).ReturnsAsync(workspace);
        var organizations = new Mock<IOrganizationService>();
        organizations.Setup(x => x.GetUserOrganizationsAsync(It.IsAny<Guid>(), user.Id)).ReturnsAsync([]);
        organizations.Setup(x => x.GetUserOrganizationsAsync(workspace.Id, user.Id))
            .ReturnsAsync(alreadyInOrganization ? [new Organization(workspace.Id, "org", "org")] : []);
        var identity = new Mock<IIdentityService>();
        identity.Setup(x => x.RegisterByEmailAsync(user.Email, "", UserOrigin.Sso, "")).ReturnsAsync(RegisterResult.Ok(user));
        identity.Setup(x => x.IssueTokensAsync(user, It.IsAny<string>())).ReturnsAsync(new AuthTokens("access", "refresh"));
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes("sso-controller-test-signing-key-at-least-32-bytes"));
        var jwt = new JwtOptions
        {
            Issuer = "test", Audience = "featbit-api", SigningSecurityKey = key, VerificationSecurityKey = key
        };
        var httpContext = new DefaultHttpContext();
        var accessor = new HttpContextAccessor { HttpContext = httpContext };
        var authorization = new SsoOrganizationJoinAuthorization(accessor, jwt, users.Object, organizations.Object);
        using var httpClient = new HttpClient(new TokenEndpointHandler(codeExchangeSucceeds, user.Email));
        var controller = new SsoController(new OidcClient(httpClient), users.Object, identity.Object,
            workspaces.Object, organizations.Object,
            new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?> { ["SSOEnabled"] = "true" }).Build(),
            NullLogger<SsoController>.Instance, authorization)
        {
            ControllerContext = new ControllerContext { HttpContext = httpContext }
        };

        var response = await controller.OidcLoginByCode(new LoginByOidcCode
        {
            Code = "code", WorkspaceKey = workspace.Key, RedirectUri = "https://app.example/callback"
        });

        Assert.Equal(codeExchangeSucceeds, response.Success);
        var cookie = httpContext.Response.Headers.SetCookie.FirstOrDefault(value =>
            value!.StartsWith(SsoOrganizationJoinAuthorization.CookieName + "="));
        if (codeExchangeSucceeds && !alreadyInOrganization)
        {
            Assert.True(response.Data!.IsSsoFirstLogin);
            Assert.NotNull(cookie);
            httpContext.User = new ClaimsPrincipal(new ClaimsIdentity(
                [new Claim(UserClaims.Id, user.Id.ToString())], Schemes.JwtBearer));
            httpContext.Request.Headers.Cookie = cookie.Split(';')[0];
            Assert.True(await authorization.CanChooseOrganizationAsync(workspace.Id, user.Id, []));
            Assert.False(await authorization.CanChooseOrganizationAsync(Guid.NewGuid(), user.Id, []));
            workspaces.Verify(x => x.AddUserIfNotExistsAsync(workspace.Id, user.Id), Times.Once);
        }
        else if (codeExchangeSucceeds)
        {
            Assert.False(response.Data!.IsSsoFirstLogin);
            Assert.Null(cookie);
        }
        else
        {
            Assert.Null(cookie);
            identity.Verify(x => x.IssueTokensAsync(It.IsAny<User>(), It.IsAny<string>()), Times.Never);
        }
    }

    private sealed class TokenEndpointHandler(bool succeeds, string email) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            // Only the external token endpoint is stubbed; the controller runs its real OIDC code exchange.
            var idToken = new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity([new Claim("email", email)]), Expires = DateTime.UtcNow.AddMinutes(5)
            });
            return Task.FromResult(new HttpResponseMessage(succeeds ? HttpStatusCode.OK : HttpStatusCode.Unauthorized)
            {
                Content = new StringContent(JsonSerializer.Serialize(new { id_token = idToken }))
            });
        }
    }
}
