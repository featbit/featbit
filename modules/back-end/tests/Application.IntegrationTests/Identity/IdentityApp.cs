using Domain.Users;
using Infrastructure.Users;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Application.IntegrationTests.Identity;

public class IdentityApp : TestApp
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(collection =>
        {
            var userStore = new ServiceDescriptor(typeof(IUserStore),
                typeof(InMemoryUserStore),
                ServiceLifetime.Scoped
            );
            var passwordHasher = new ServiceDescriptor(
                typeof(IPasswordHasher<User>),
                typeof(TestPasswordHasher),
                ServiceLifetime.Scoped
            );

            collection.Replace(userStore);
            collection.Replace(passwordHasher);
        });
    }
}