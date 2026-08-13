using System.Net.Http.Headers;
using Api.Authorization;
using Application.Bases.Models;
using Application.FeatureFlags;
using Application.Identity;
using Application.Services;
using Application.Users;
using Domain.Users;
using Infrastructure.Caches;
using Infrastructure.MQ;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Moq;

namespace Application.IntegrationTests.Controllers;

/// <summary>
/// Custom WebApplicationFactory for permission-tagged controller tests.
/// Replaces <see cref="IPermissionChecker"/> with <see cref="TestPermissionChecker"/>
/// and <see cref="ISender"/> with a Moq mock so individual tests can drive both the
/// policy outcome and the mediator response without standing up the full handler graph.
/// </summary>
public class PermissionCheckTestApp : WebApplicationFactory<Program>
{
    public TestPermissionChecker PermissionChecker { get; } = new();
    public Mock<ISender> Sender { get; } = new(MockBehavior.Strict);

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting(MqProvider.SectionName, MqProvider.None);
        builder.UseSetting(CacheProvider.SectionName, CacheProvider.None);

        builder.ConfigureServices(collection =>
        {
            collection.Replace(ServiceDescriptor.Scoped<IPasswordHasher<User>, TestPasswordHasher>());
            collection.Replace(ServiceDescriptor.Singleton<ICurrentUser>(new TestCurrentUser(TestUser.Id)));
            collection.Replace(ServiceDescriptor.Transient<IWorkspaceService, TestWorkspaceService>());
            collection.Replace(ServiceDescriptor.Transient<IUserService, TestUserService>());
            collection.Replace(ServiceDescriptor.Transient<IRefreshTokenService, TestRefreshTokenService>());

            collection.Replace(ServiceDescriptor.Singleton<IPermissionChecker>(PermissionChecker));
            collection.Replace(ServiceDescriptor.Singleton<ISender>(Sender.Object));

            var hostedServices = collection.Where(x =>
                x.ServiceType.IsAssignableTo(typeof(IHostedService)) &&
                x.ImplementationType?.FullName?.Contains("Microsoft") == false
            ).ToArray();

            foreach (var service in hostedServices)
            {
                collection.Remove(service);
            }
        });

        builder.ConfigureLogging(
            logging => logging.AddFilter("Microsoft.AspNetCore.Diagnostics.ExceptionHandlerMiddleware", LogLevel.None)
        );
    }

    public async Task<HttpClient> CreateAuthenticatedClientAsync()
    {
        var client = CreateClient();
        var scopeFactory = Services.GetRequiredService<IServiceScopeFactory>();
        using var scope = scopeFactory.CreateScope();
        var identityService = scope.ServiceProvider.GetRequiredService<IIdentityService>();
        var tokens = await identityService.IssueTokensAsync(TestUser.Instance(), "::1");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            JwtBearerDefaults.AuthenticationScheme, tokens.AccessToken);
        return client;
    }
}
