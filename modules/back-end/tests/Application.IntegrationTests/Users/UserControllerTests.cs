using System.Net.Http.Headers;
using Application.Users;
using Domain.Users;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Application.IntegrationTests.Users;

[Collection(nameof(TestApp))]
[UsesVerify]
public class UserControllerTests
{
    private readonly TestApp _app;

    public UserControllerTests(TestApp app)
    {
        _app = app;
    }

    [Fact]
    public async Task GetUserProfile()
    {
        var response = await _app.GetAsync("/api/v1/user/profile");

        await Verify(response);
    }

    [Fact]
    public async Task GetUserProfile_NotExist()
    {
        var userNotExist = new User(Guid.NewGuid(), "email", "pwd");
        var token = _app.GetToken(userNotExist);

        var factory = _app.WithWebHostBuilder(builder => builder.ConfigureTestServices(collection =>
        {
            collection.Replace(ServiceDescriptor.Singleton<ICurrentUser>(new TestCurrentUser(userNotExist.Id)));
        }));

        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        
        var response = await client.GetAsync("/api/v1/user/profile");
        await Verify(response);
    }
}