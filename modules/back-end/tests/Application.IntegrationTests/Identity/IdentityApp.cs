using Domain.Identity;
using Infrastructure.Identity;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Application.IntegrationTests.Identity;

public class IdentityApp : WebApplicationFactory<Program>
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