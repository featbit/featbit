using Application.Users;
using Infrastructure.Users;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Application.IntegrationTests.Users;

public class UserApp : TestApp
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(collection =>
        {
            var userStore = new ServiceDescriptor(
                typeof(IUserStore),
                typeof(InMemoryUserStore),
                ServiceLifetime.Scoped
            );
            var currentUser = ServiceDescriptor.Singleton<ICurrentUser>(new TestCurrentUser(TestUser.Id));

            collection.Replace(userStore);
            collection.Replace(currentUser);
        });
    }
}