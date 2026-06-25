using System.Net.Http.Headers;
using System.Net.Mime;
using System.Text;
using System.Text.Json;
using Api;
using Api.Authorization;
using Application.Identity;
using Application.Services;
using Application.Users;
using Domain.Users;
using Infrastructure.Caches;
using Infrastructure.MQ;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Application.IntegrationTests;

public class TestApp : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting(MqProvider.SectionName, MqProvider.None);
        builder.UseSetting(CacheProvider.SectionName, CacheProvider.None);

        builder.ConfigureServices(collection =>
        {
            var passwordHasher = new ServiceDescriptor(
                typeof(IPasswordHasher<User>),
                typeof(TestPasswordHasher),
                ServiceLifetime.Scoped
            );
            var currentUser = ServiceDescriptor.Singleton<ICurrentUser>(new TestCurrentUser(TestUser.Id));

            collection.Replace(passwordHasher);
            collection.Replace(currentUser);

            collection.Replace(ServiceDescriptor.Transient<IWorkspaceService, TestWorkspaceService>());
            collection.Replace(ServiceDescriptor.Transient<IOrganizationService, TestOrganizationService>());
            collection.Replace(ServiceDescriptor.Transient<IUserService, TestUserService>());
            collection.Replace(ServiceDescriptor.Transient<IEnvironmentService, TestEnvironmentService>());
            collection.Replace(ServiceDescriptor.Transient<IRefreshTokenService, TestRefreshTokenService>());
            collection.Replace(ServiceDescriptor.Transient<IPermissionChecker, TestPermissionChecker>());
            collection.Replace(ServiceDescriptor.Transient<IAccessTokenService, TestAccessTokenService>());
            collection.Replace(ServiceDescriptor.Singleton<IMcpAuthorizationStore, TestMcpAuthorizationStore>());
            collection.Replace(ServiceDescriptor.Transient<IReleaseDecisionExperimentService, TestReleaseDecisionExperimentService>());
            collection.Replace(ServiceDescriptor.Transient<IExperimentStatsService, TestExperimentStatsService>());

            var hostedServices = collection.Where(x =>
                x.ServiceType.IsAssignableTo(typeof(IHostedService)) &&
                x.ImplementationType?.FullName?.Contains("Microsoft") == false
            ).ToArray();

            foreach (var service in hostedServices)
            {
                collection.Remove(service);
            }
        });

        // filtering ExceptionHandlerMiddleware logs 
        builder.ConfigureLogging(
            logging => logging.AddFilter("Microsoft.AspNetCore.Diagnostics.ExceptionHandlerMiddleware", LogLevel.None)
        );
    }

    public async Task<HttpResponseMessage> GetAsync(string uri, bool authenticated = true)
    {
        var client = CreateClient();
        if (authenticated)
        {
            await AddAuthorizationHeader(client, includeWorkspaceContext: false);
        }

        return await client.GetAsync(uri);
    }

    public Task<HttpResponseMessage> GetWithAccessTokenAsync(string uri)
    {
        var client = CreateClient();
        AddOpenApiAccessTokenHeader(client);

        return client.GetAsync(uri);
    }

    public async Task<HttpResponseMessage> PostAsync(
        string uri,
        object payload,
        bool authenticated = true,
        bool includeWorkspaceContext = false)
    {
        var client = CreateClient();
        if (authenticated)
        {
            await AddAuthorizationHeader(client, includeWorkspaceContext);
        }

        var body = JsonSerializer.Serialize(payload);
        var content = new StringContent(body, Encoding.UTF8, MediaTypeNames.Application.Json);

        return await client.PostAsync(uri, content);
    }

    public Task<HttpResponseMessage> PostWithAccessTokenAsync(string uri, object payload)
    {
        var client = CreateClient();
        AddOpenApiAccessTokenHeader(client);

        var body = JsonSerializer.Serialize(payload);
        var content = new StringContent(body, Encoding.UTF8, MediaTypeNames.Application.Json);

        return client.PostAsync(uri, content);
    }

    public async Task<HttpResponseMessage> PutAsync(
        string uri,
        object payload,
        bool authenticated = true,
        bool includeWorkspaceContext = false)
    {
        var client = CreateClient();
        if (authenticated)
        {
            await AddAuthorizationHeader(client, includeWorkspaceContext);
        }

        var body = JsonSerializer.Serialize(payload);
        var content = new StringContent(body, Encoding.UTF8, MediaTypeNames.Application.Json);

        return await client.PutAsync(uri, content);
    }

    public Task<HttpResponseMessage> PutWithAccessTokenAsync(string uri, object payload)
    {
        var client = CreateClient();
        AddOpenApiAccessTokenHeader(client);

        var body = JsonSerializer.Serialize(payload);
        var content = new StringContent(body, Encoding.UTF8, MediaTypeNames.Application.Json);

        return client.PutAsync(uri, content);
    }

    public Task<HttpResponseMessage> DeleteWithAccessTokenAsync(string uri)
    {
        var client = CreateClient();
        AddOpenApiAccessTokenHeader(client);

        return client.DeleteAsync(uri);
    }

    public async Task<AuthTokens> GetTokenAsync(User user)
    {
        var scopeFactory = Services.GetRequiredService<IServiceScopeFactory>();
        using var scope = scopeFactory.CreateScope();
        var identityService = scope.ServiceProvider.GetRequiredService<IIdentityService>();

        var tokens = await identityService.IssueTokensAsync(user, "::1");
        return tokens;
    }

    private async Task AddAuthorizationHeader(HttpClient client, bool includeWorkspaceContext)
    {
        var authTokens = await GetTokenAsync(TestUser.Instance());
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            JwtBearerDefaults.AuthenticationScheme, authTokens.AccessToken
        );

        if (includeWorkspaceContext)
        {
            client.DefaultRequestHeaders.Add(ApiConstants.OrgIdHeaderKey, TestWorkspace.OrganizationId.ToString());
            client.DefaultRequestHeaders.Add(ApiConstants.WorkspaceHeaderKey, TestWorkspace.Id.ToString());
        }
    }

    private static void AddOpenApiAccessTokenHeader(HttpClient client)
    {
        client.DefaultRequestHeaders.TryAddWithoutValidation("Authorization", TestAccessTokenService.PersonalToken);
    }
}
