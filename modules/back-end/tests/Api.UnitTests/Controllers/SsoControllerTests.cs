using System.IdentityModel.Tokens.Jwt;
using System.Linq.Expressions;
using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Api.Authentication.OpenIdConnect;
using Api.Controllers;
using Application.Identity;
using Application.Services;
using Domain.Organizations;
using Domain.Users;
using Domain.Workspaces;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;

namespace Api.UnitTests.Controllers;

public class SsoControllerTests
{
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task Login_WithoutOrganization_ResumesOnboardingUntilJoinSucceeds(bool existingUser)
    {
        var (controller, user, organizations, users, workspace) = CreateController(existingUser);
        var request = new LoginByOidcCode { WorkspaceKey = workspace.Key, Code = "code", RedirectUri = "https://app.test" };

        var first = await controller.OidcLoginByCode(request);
        Assert.True(first.Success);
        Assert.NotNull(first.Data);
        Assert.True(first.Data.IsSsoFirstLogin);

        // Account creation persists even when the subsequent organization join fails.
        users.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<User, bool>>>())).ReturnsAsync(user);
        var retry = await controller.OidcLoginByCode(request);
        Assert.True(retry.Success);
        Assert.NotNull(retry.Data);
        Assert.True(retry.Data.IsSsoFirstLogin);

        organizations.Setup(x => x.GetUserOrganizationsAsync(workspace.Id, user.Id))
            .ReturnsAsync(new List<Organization> { new() });
        var afterJoin = await controller.OidcLoginByCode(request);
        Assert.True(afterJoin.Success);
        Assert.NotNull(afterJoin.Data);
        Assert.False(afterJoin.Data.IsSsoFirstLogin);
    }

    [Fact]
    public async Task Login_MemberOfAnotherWorkspace_StillNeedsOrganizationInSsoWorkspace()
    {
        var (controller, user, organizations, _, workspace) = CreateController(true);
        organizations.Setup(x => x.GetUserOrganizationsAsync(It.Is<Guid>(id => id != workspace.Id), user.Id))
            .ReturnsAsync(new List<Organization> { new() });

        var result = await controller.OidcLoginByCode(new LoginByOidcCode
        {
            WorkspaceKey = workspace.Key, Code = "code", RedirectUri = "https://app.test"
        });

        Assert.True(result.Success);
        Assert.NotNull(result.Data);
        Assert.True(result.Data.IsSsoFirstLogin);
        organizations.Verify(x => x.GetUserOrganizationsAsync(workspace.Id, user.Id), Times.Once);
    }

    private static (SsoController, User, Mock<IOrganizationService>, Mock<IUserService>, Workspace)
        CreateController(bool existingUser)
    {
        var user = new User(Guid.NewGuid(), "sso@example.com", "", origin: UserOrigin.Sso);
        var workspace = new Workspace { Id = Guid.NewGuid(), Key = "sso-workspace" };
        using var rsa = RSA.Create();
        LicenseVerifier.ImportPublicKey(rsa.ExportSubjectPublicKeyInfoPem());
        var payload = Convert.ToBase64String(JsonSerializer.SerializeToUtf8Bytes(new License
        {
            WsId = workspace.Id, Issuer = "https://www.featbit.co",
            Exp = DateTimeOffset.UtcNow.AddHours(1).ToUnixTimeMilliseconds(), Features = [LicenseFeatures.Sso]
        }, new JsonSerializerOptions(JsonSerializerDefaults.Web)));
        var signature = rsa.SignData(Encoding.UTF8.GetBytes(payload), HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        workspace.License = $"{Convert.ToBase64String(signature)}.{payload}";
        workspace.UpdateSsoOidc(new OidcConfig
        {
            TokenEndpoint = "https://idp.test/token", UserEmailClaim = "email",
            ClientAuthenticationMethod = "client_secret_post", ClientId = "client", ClientSecret = "secret"
        });

        var users = new Mock<IUserService>();
        users.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<User, bool>>>()))
            .ReturnsAsync(existingUser ? user : null);
        var identity = new Mock<IIdentityService>();
        identity.Setup(x => x.RegisterByEmailAsync(user.Email, "", UserOrigin.Sso, ""))
            .ReturnsAsync(RegisterResult.Ok(user));
        identity.Setup(x => x.IssueTokensAsync(user, It.IsAny<string>()))
            .ReturnsAsync(new AuthTokens("access", "refresh"));
        var workspaces = new Mock<IWorkspaceService>();
        workspaces.Setup(x => x.FindOneAsync(It.IsAny<Expression<Func<Workspace, bool>>>())).ReturnsAsync(workspace);
        var organizations = new Mock<IOrganizationService>();
        organizations.Setup(x => x.GetUserOrganizationsAsync(workspace.Id, user.Id))
            .ReturnsAsync(new List<Organization>());
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(
            new Dictionary<string, string?> { ["SSOEnabled"] = "true" }).Build();
        var client = new OidcClient(new HttpClient(new TokenHandler(user.Email)));
        var controller = new SsoController(client, users.Object, identity.Object, workspaces.Object,
            organizations.Object, configuration, NullLogger<SsoController>.Instance)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
        return (controller, user, organizations, users, workspace);
    }

    private sealed class TokenHandler(string email) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var token = new JwtSecurityToken(claims: [new Claim("email", email)]);
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = JsonContent.Create(new { id_token = new JwtSecurityTokenHandler().WriteToken(token) })
            });
        }
    }
}
